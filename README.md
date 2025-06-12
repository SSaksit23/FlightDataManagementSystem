# Tour Operator System ✈️🏨🗺️

This project is a web application designed to help users search for flight information and, potentially in the future, hotel bookings. It integrates with the Amadeus API to fetch real-time travel data and aims to provide a user-friendly interface for planning trips. The frontend is built with React and styled with Bootstrap, and it includes features like airline logo display and (in-progress) map integration. The backend is a Node.js/Express server. The entire application is containerized using Docker for easier development and deployment.

## Current Features

* **Flight Search:**
    * Search for one-way and round-trip flights.
    * Specify origin and destination (using IATA codes).
    * Select departure and (optional) return dates.
    * Specify the number of adult passengers.
    * Select preferred currency for flight prices.
* **Results Display:**
    * Lists flight offers with total price.
    * Displays airline logos (PNG format, locally hosted).
    * Shows itinerary details including flight segments, departure/arrival times, airline codes, and flight numbers.
    * Gracefully handles missing airline names or aircraft details if backend dictionaries are unavailable.
* **User Interface:**
    * Built with React and `react-bootstrap` for a modern look and feel.
    * Responsive layout with centered content.
    * Google Maps integration for displaying origin/destination (currently dependent on Amadeus `include` parameter functionality).
* **Backend API:**
    * Node.js/Express server.
    * Endpoints for health checks and flight offer searches via Amadeus API.
    * Handles Amadeus API key management via environment variables.
* **Development Environment:**
    * Fully containerized using Docker and Docker Compose for frontend, backend, (and optionally PostgreSQL, Redis, PgAdmin).

## Tech Stack

* **Frontend:** React, JavaScript, Axios, `react-bootstrap`, `bootstrap`, `@react-google-maps/api` (for map), local PNG airline logos.
* **Backend:** Node.js, Express.js, Amadeus Node SDK.
* **API Integration:** Amadeus Self-Service APIs.
* **Containerization:** Docker, Docker Compose.
* **Environment Management:** `.env` files.

## Prerequisites

Before you begin, ensure you have the following installed:
* [Git](https://git-scm.com/)
* [Docker Desktop](https://www.docker.com/products/docker-desktop/) (which includes Docker and Docker Compose)
* A code editor (e.g., VS Code)
* An Amadeus for Developers Account to get your API Key and Secret.
* A Google Maps JavaScript API Key (if enabling the map feature fully) with the Maps JavaScript API enabled in your Google Cloud Console project.

## Project Setup & Local Development

1.  **Clone the Repository:**
    ```bash
    git clone [https://github.com/SSaksit23/tos_system_1.git](https://github.com/SSaksit23/tos_system_1.git) 
    cd tos_system_1
    ```

2.  **Configure Backend Environment Variables:**
    * Navigate to the `backend` directory: `cd backend`
    * Create a `.env` file by copying from `.env.example` if you have one, or create it new.
    * Add your Amadeus API credentials and other necessary variables:
        ```env
        # backend/.env
        AMADEUS_CLIENT_ID=YOUR_AMADEUS_API_KEY
        AMADEUS_CLIENT_SECRET=YOUR_AMADEUS_API_SECRET
        AMADEUS_HOSTNAME=test # or 'production'
        PORT=5000
        NODE_ENV=development
        # Add DATABASE_URL, REDIS_HOST, REDIS_PORT if using these services
        ```
    * Return to the project root: `cd ..`

3.  **Configure Frontend Environment Variables (for Google Maps):**
    * Navigate to the `frontend` directory: `cd frontend`
    * Create a `.env` file.
    * Add your Google Maps API Key:
        ```env
        # frontend/.env
        REACT_APP_Maps_API_KEY=YOUR_Maps_API_KEY
        ```
        *(Ensure this variable name `REACT_APP_Maps_API_KEY` matches what's used in your `GoogleMapComponent.js`)*
    * Return to the project root: `cd ..`

4.  **Ensure `.gitignore` is protecting your `.env` files:**
    Verify that your main `.gitignore` file in the project root contains lines like:
    ```gitignore
    backend/.env
    frontend/.env
    ```

5.  **Airline Logos:**
    * Place your PNG airline logo files (named by IATA code, e.g., `TG.png`, `AA.png`) into the `frontend/public/images/airlines/` directory. The application is currently set up to look for `.png` files here.

6.  **Build and Run with Docker Compose:**
    From the project root directory (where `docker-compose.yml` is located):
    ```bash
    docker-compose up --build -d
    ```
    * The `--build` flag rebuilds images if there are changes to Dockerfiles or source code context.
    * `-d` runs containers in detached mode.

7.  **Access the Application:**
    * Frontend: `http://localhost:3000`
    * Backend API (e.g., health check): `http://localhost:5000/api/health`

## Using the Application

* Navigate to `http://localhost:3000`.
* The backend connection status should be displayed.
* Use the form to search for flights:
    * Select Trip Type (One-Way or Round Trip).
    * Choose your preferred Currency.
    * Enter Origin and Destination IATA codes.
    * Select Departure Date (and Return Date for round trips).
    * Specify the number of Adults.
    * Click "Search Flights."
* Results will be displayed below, including price, itinerary details, and airline logos. The map feature's success depends on the Amadeus API returning dictionary data (currently an ongoing troubleshooting point with the `include` parameter).

## Current Status & Known Issues

* **Amadeus `include` Parameter:** The backend `server.js` currently has the `include` parameter for the Amadeus Flight Offers Search commented out. This was done to bypass an "INVALID OPTION" error from the Amadeus API.
    * **Impact:** Because of this, the `dictionaries` object (containing location coordinates, full airline names, aircraft types) is not being fetched.
    * **Consequence for UI:**
        * The Google Map will display "Map data not available (dictionaries not loaded)."
        * Full airline names will be replaced by carrier codes.
        * Aircraft type details will show "N/A" or the aircraft code.
* Basic flight search and price display are functional.
* Airline logos (PNGs hosted locally) are displayed.

## Future Enhancements / To-Do

* **Resolve Amadeus `include` Parameter Issue:** Investigate and fix the problem with the `include` parameter to successfully fetch `dictionaries` for maps, full airline names, and aircraft details.
* **Location Autocomplete:** Implement IATA code lookup for origin and destination fields using the `/api/locations/search` backend endpoint.
* **Hotel Search Module:** Add functionality to search and display hotel information.
* **Multi-City Flight Search.**
* **User Accounts & Bookings:** Implement user authentication and a booking management system.
* **Advanced Filtering & Sorting** for flight results.
* **UI/UX Refinements.**
* **Deployment to a Cloud Platform** (e.g., Railway, Google Cloud Run).

└── README.md           # This file
