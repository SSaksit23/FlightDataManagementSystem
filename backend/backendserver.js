const express = require('express');
const cors = require('cors');
const redis = require('redis');
const { Pool } = require('pg');
const Amadeus = require('amadeus');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Redis client
const redisClient = redis.createClient({
  socket: {
    host: process.env.REDIS_HOST || 'redis',
    port: process.env.REDIS_PORT || 6379
  }
});

redisClient.connect().catch(console.error);

// Amadeus client with your API keys
const amadeus = new Amadeus({
  clientId: 'Bd76Zxmr3DtsAgSCNVhRlgCzzFDROM07',
  clientSecret: 'Onw33473vAI1CTHS',
  hostname: 'test'
});

// Routes
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    amadeus: 'Connected'
  });
});

// Location search endpoint
app.get('/api/locations/search', async (req, res) => {
  try {
    const { keyword } = req.query;
    
    if (!keyword || keyword.length < 2) {
      return res.status(400).json({ error: 'Keyword must be at least 2 characters' });
    }

    const response = await amadeus.referenceData.locations.get({
      keyword,
      subType: 'AIRPORT,CITY',
      sort: 'analytics.travelers.score',
      'page[limit]': 10
    });

    const locations = response.data.map(location => ({
      code: location.iataCode,
      name: location.name,
      city: location.address?.cityName,
      country: location.address?.countryName,
      type: location.subType,
      latitude: location.geoCode?.latitude,
      longitude: location.geoCode?.longitude
    }));

    res.json(locations);

  } catch (error) {
    console.error('Location search error:', error);
    res.status(500).json({ 
      error: 'Failed to search locations',
      details: error.description || error.message 
    });
  }
});

// Flight search endpoint
app.post('/api/flights/search', async (req, res) => {
  try {
    const {
      originLocationCode,
      destinationLocationCode,
      departureDate,
      adults = 1
    } = req.body;

    if (!originLocationCode || !destinationLocationCode || !departureDate) {
      return res.status(400).json({ 
        error: 'Origin, destination, and departure date are required' 
      });
    }

    const searchParams = {
      originLocationCode,
      destinationLocationCode,
      departureDate,
      adults: parseInt(adults),
      max: 10
    };

    const response = await amadeus.shopping.flightOffersSearch.get(searchParams);

    const flights = response.data.map(offer => ({
      id: offer.id,
      price: {
        total: offer.price.total,
        currency: offer.price.currency
      },
      itineraries: offer.itineraries.map(itinerary => ({
        duration: itinerary.duration,
        segments: itinerary.segments.map(segment => ({
          departure: {
            iataCode: segment.departure.iataCode,
            at: segment.departure.at
          },
          arrival: {
            iataCode: segment.arrival.iataCode,
            at: segment.arrival.at
          },
          carrierCode: segment.carrierCode,
          number: segment.number,
          numberOfStops: segment.numberOfStops || 0
        }))
      })),
      validatingAirlineCodes: offer.validatingAirlineCodes
    }));

    // Get coordinates for map
    const getCoords = async (code) => {
      try {
        const locResponse = await amadeus.referenceData.locations.get({
          keyword: code,
          subType: 'AIRPORT,CITY'
        });
        const location = locResponse.data.find(loc => loc.iataCode === code);
        return location?.geoCode ? {
          latitude: location.geoCode.latitude,
          longitude: location.geoCode.longitude,
          name: location.name,
          city: location.address?.cityName,
          country: location.address?.countryName
        } : null;
      } catch (error) {
        return null;
      }
    };

    const [originCoords, destCoords] = await Promise.all([
      getCoords(originLocationCode),
      getCoords(destinationLocationCode)
    ]);

    res.json({
      flights,
      mapData: {
        origin: originCoords ? { code: originLocationCode, ...originCoords } : null,
        destination: destCoords ? { code: destinationLocationCode, ...destCoords } : null
      }
    });

  } catch (error) {
    console.error('Flight search error:', error);
    res.status(500).json({ 
      error: 'Failed to search flights',
      details: error.description || error.message 
    });
  }
});

// Hotel search endpoint
app.get('/api/hotels/search', async (req, res) => {
  try {
    const {
      cityCode,
      checkInDate,
      checkOutDate,
      adults = 1
    } = req.query;

    if (!cityCode || !checkInDate || !checkOutDate) {
      return res.status(400).json({ 
        error: 'City code, check-in and check-out dates are required' 
      });
    }

    // Get hotels by city
    const hotelListResponse = await amadeus.referenceData.locations.hotels.byCity.get({
      cityCode
    });

    if (!hotelListResponse.data || hotelListResponse.data.length === 0) {
      return res.json({ hotels: [] });
    }

    const hotelIds = hotelListResponse.data.slice(0, 20).map(hotel => hotel.hotelId);

    // Get hotel offers
    const offersResponse = await amadeus.shopping.hotelOffersSearch.get({
      hotelIds: hotelIds.join(','),
      checkInDate,
      checkOutDate,
      adults: parseInt(adults)
    });

    const hotels = offersResponse.data.map(hotel => ({
      hotelId: hotel.hotel.hotelId,
      name: hotel.hotel.name,
      rating: hotel.hotel.rating,
      address: hotel.hotel.address,
      geoCode: hotel.hotel.geoCode,
      offers: hotel.offers?.map(offer => ({
        id: offer.id,
        price: offer.price,
        room: offer.room,
        boardType: offer.boardType
      })) || []
    }));

    res.json({
      hotels: hotels.filter(hotel => hotel.offers.length > 0),
      mapData: {
        hotels: hotels.map(hotel => ({
          hotelId: hotel.hotelId,
          name: hotel.name,
          coordinates: hotel.geoCode,
          rating: hotel.rating
        })).filter(hotel => hotel.coordinates)
      }
    });

  } catch (error) {
    console.error('Hotel search error:', error);
    res.status(500).json({ 
      error: 'Failed to search hotels',
      details: error.description || error.message 
    });
  }
});

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
  console.log(`✈️  Amadeus API: Connected with your keys`);
});