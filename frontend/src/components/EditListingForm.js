import React, { useState, useEffect, useCallback } from 'react';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-toastify';
import { PlusCircle, Trash2, Info, Loader2, UploadCloud, X, DollarSign, Clock, Users, Tag, MapPin, FileText, CheckSquare, XSquare, CalendarCheck, HelpCircle, Eye, Image as ImageIconLucide, Video as VideoIconLucide } from 'lucide-react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const EditListingForm = () => {
  const { listingId } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();

  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [loadingListing, setLoadingListing] = useState(true);
  const [listingData, setListingData] = useState(null);
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [formError, setFormError] = useState(null);

  const [existingMedia, setExistingMedia] = useState([]);
  const [newMediaFiles, setNewMediaFiles] = useState([]); // Store File objects for new uploads
  const [newMediaPreviews, setNewMediaPreviews] = useState([]); // Store previews for new files
  const [mediaToDelete, setMediaToDelete] = useState([]); // Store IDs of existing media to delete

  const { register, handleSubmit, control, watch, formState: { errors }, reset, setValue } = useForm({
    defaultValues: {
      title: '',
      description: '',
      category_id: '',
      custom_location: { city: '', country: '', address: '' },
      base_price: '',
      currency: 'USD',
      duration_hours: null,
      is_multi_day: false,
      total_days: null,
      max_travelers: null,
      is_customizable: false,
      is_example_itinerary: false,
      inclusions: [],
      exclusions: [],
      itinerary: [],
      requirements: '',
      cancellation_policy: '',
      status: 'draft',
    },
  });

  const { fields: inclusionFields, append: appendInclusion, remove: removeInclusion } = useFieldArray({ control, name: "inclusions" });
  const { fields: exclusionFields, append: appendExclusion, remove: removeExclusion } = useFieldArray({ control, name: "exclusions" });
  const { fields: itineraryFields, append: appendItinerary, remove: removeItinerary } = useFieldArray({ control, name: "itinerary" });

  const isMultiDay = watch('is_multi_day');

  const populateForm = useCallback((data) => {
    if (data) {
      reset({
        title: data.title || '',
        description: data.description || '',
        category_id: data.category_id || '',
        custom_location: data.custom_location || { city: '', country: '', address: '' },
        base_price: data.base_price || '',
        currency: data.currency || 'USD',
        duration_hours: data.duration_hours === null ? '' : data.duration_hours, // Handle null for number input
        is_multi_day: data.is_multi_day || false,
        total_days: data.total_days === null ? '' : data.total_days,
        max_travelers: data.max_travelers === null ? '' : data.max_travelers,
        is_customizable: data.is_customizable || false,
        is_example_itinerary: data.is_example_itinerary || false,
        inclusions: data.inclusions?.map(val => ({ value: val })) || [{ value: '' }],
        exclusions: data.exclusions?.map(val => ({ value: val })) || [{ value: '' }],
        itinerary: data.itinerary?.length > 0 ? data.itinerary : [{ day_number: 1, title: '', description: '' }],
        requirements: data.requirements || '',
        cancellation_policy: data.cancellation_policy || '',
        status: data.status || 'draft',
      });
      setExistingMedia(data.media || []);
    }
  }, [reset]);

  useEffect(() => {
    const fetchListingData = async () => {
      if (!token || !listingId) {
        setLoadingListing(false);
        toast.error("Missing token or listing ID.");
        navigate('/provider/dashboard');
        return;
      }
      try {
        setLoadingListing(true);
        const response = await axios.get(`${API_URL}/providers/listings/${listingId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setListingData(response.data);
        populateForm(response.data);
      } catch (error) {
        console.error("Error fetching listing data:", error);
        if (error.response?.status === 404) {
          toast.error("Listing not found.");
        } else if (error.response?.status === 403) {
          toast.error("You are not authorized to edit this listing.");
        } else {
          toast.error("Failed to load listing data.");
        }
        navigate('/provider/dashboard');
      } finally {
        setLoadingListing(false);
      }
    };
    fetchListingData();
  }, [token, listingId, navigate, populateForm]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setLoadingCategories(true);
        const response = await axios.get(`${API_URL}/search/categories`);
        setCategories(response.data || []);
      } catch (error) {
        console.error("Error fetching categories:", error);
        toast.error("Failed to load categories.");
      } finally {
        setLoadingCategories(false);
      }
    };
    fetchCategories();
  }, []);
  
  const handleNewMediaChange = (event) => {
    const files = Array.from(event.target.files);
    const currentTotalMedia = existingMedia.length - mediaToDelete.length + newMediaFiles.length;
    const remainingSlots = 10 - currentTotalMedia;
    
    const filesToAdd = files.slice(0, remainingSlots);
    setNewMediaFiles(prevFiles => [...prevFiles, ...filesToAdd]);

    const newPreviewsToAdd = filesToAdd.map(file => ({
        name: file.name,
        url: URL.createObjectURL(file),
        type: file.type,
        isNew: true
    }));
    setNewMediaPreviews(prevPreviews => [...prevPreviews, ...newPreviewsToAdd]);

    if (files.length > remainingSlots) {
        toast.warn(`You can upload a maximum of 10 media files in total. ${remainingSlots} slots were available.`);
    }
  };

  const removeNewMediaPreview = (index) => {
    const fileToRemove = newMediaPreviews[index];
    URL.revokeObjectURL(fileToRemove.url); // Clean up object URL
    setNewMediaPreviews(prev => prev.filter((_, i) => i !== index));
    setNewMediaFiles(prev => prev.filter((_, i) => i !== index));
  };

  const toggleDeleteExistingMedia = (mediaId) => {
    setMediaToDelete(prev => 
      prev.includes(mediaId) ? prev.filter(id => id !== mediaId) : [...prev, mediaId]
    );
  };

  useEffect(() => {
    // Clean up Object URLs for new media previews
    return () => {
      newMediaPreviews.forEach(file => URL.revokeObjectURL(file.url));
    };
  }, [newMediaPreviews]);

  const onSubmit = async (data) => {
    if (!token) {
      toast.error("Authentication error. Please log in again.");
      return;
    }
    setLoadingSubmit(true);
    setFormError(null);

    // Prepare data for the main listing update (textual/JSON data)
    const listingUpdateData = {
      ...data,
      inclusions: data.inclusions.map(item => item.value).filter(Boolean),
      exclusions: data.exclusions.map(item => item.value).filter(Boolean),
      itinerary: data.itinerary.filter(item => item.title && item.description),
    };
    // Remove fields not expected by the backend for update, or handle them if backend supports
    delete listingUpdateData.media; 

    try {
      // 1. Update listing textual data
      await axios.put(`${API_URL}/providers/listings/${listingId}`, listingUpdateData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success('Listing details updated successfully!');

      // 2. Delete media marked for deletion
      if (mediaToDelete.length > 0) {
        for (const mediaId of mediaToDelete) {
          try {
            await axios.delete(`${API_URL}/providers/listings/${listingId}/media/${mediaId}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            toast.info(`Media item ${mediaId} deleted.`);
          } catch (mediaDeleteError) {
            console.error(`Error deleting media ${mediaId}:`, mediaDeleteError);
            toast.error(`Failed to delete media item ${mediaId}.`);
          }
        }
        setMediaToDelete([]); // Clear deletion queue
      }

      // 3. Upload new media files
      if (newMediaFiles.length > 0) {
        const mediaFormData = new FormData();
        newMediaFiles.forEach(file => {
          mediaFormData.append('mediaFiles', file);
        });
        // Add any other relevant data for media upload if needed by backend, e.g., captions
        // formData.append('caption', 'Default caption for new uploads'); 

        try {
          await axios.post(`${API_URL}/providers/listings/${listingId}/media`, mediaFormData, {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'multipart/form-data',
            },
          });
          toast.success(`${newMediaFiles.length} new media file(s) uploaded.`);
          setNewMediaFiles([]);
          setNewMediaPreviews([]);
        } catch (mediaUploadError) {
          console.error("Error uploading new media:", mediaUploadError);
          toast.error("Failed to upload new media files. Listing details were updated.");
        }
      }
      
      navigate('/provider/dashboard');
    } catch (error) {
      console.error("Error updating listing:", error.response?.data || error.message);
      const errMsg = error.response?.data?.message || "Failed to update listing. Please check your input.";
      setFormError(errMsg);
      toast.error(errMsg);
    } finally {
      setLoadingSubmit(false);
    }
  };
  
  const FormSection = ({ title, icon, children, tooltip }) => (
    <div className="bg-white p-6 rounded-lg shadow mb-6">
      <div className="flex items-center mb-4 border-b pb-3">
        {icon}
        <h2 className="text-xl font-semibold text-gray-700 ml-2">{title}</h2>
        {tooltip && (
          <div className="ml-2 group relative">
            <HelpCircle className="h-5 w-5 text-gray-400 hover:text-gray-600 cursor-pointer" />
            <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-max max-w-xs p-2 bg-gray-700 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
              {tooltip}
            </span>
          </div>
        )}
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );

  const FieldWrapper = ({ label, name, children, error, required, tooltip }) => (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
        {tooltip && (
          <div className="ml-1 inline-block group relative">
            <HelpCircle className="h-4 w-4 text-gray-400 hover:text-gray-600 cursor-pointer" />
            <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 w-max max-w-xs p-1.5 bg-gray-700 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
              {tooltip}
            </span>
          </div>
        )}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error.message}</p>}
    </div>
  );

  const inputClass = "mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm";
  const textareaClass = "mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm min-h-[100px]";

  if (loadingListing) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
        <p className="ml-4 text-lg text-gray-700">Loading Listing Data...</p>
      </div>
    );
  }

  if (!listingData) { // Handles case where fetching failed and navigate hasn't kicked in yet
    return (
        <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 bg-gray-50 text-center">
            <Info className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-700">Listing Not Found</h1>
            <p className="text-gray-600 mt-2">Could not load data for listing ID: {listingId}.</p>
            <button onClick={() => navigate('/provider/dashboard')} className="mt-6 px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700">
              Back to Dashboard
            </button>
        </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 bg-gray-50">
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-6">Edit Service Listing</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {formError && (
          <div className="p-3 bg-red-100 text-red-700 border border-red-300 rounded-md text-sm">
            {formError}
          </div>
        )}

        <FormSection title="Basic Information" icon={<Info className="h-6 w-6 text-blue-600" />} tooltip="Core details about your service.">
          <FieldWrapper label="Listing Title" name="title" error={errors.title} required tooltip="A catchy and descriptive title for your service.">
            <input type="text" id="title" {...register("title", { required: "Title is required" })} className={inputClass} />
          </FieldWrapper>
          <FieldWrapper label="Description" name="description" error={errors.description} required tooltip="Detailed description of the service, what makes it unique, and what travelers can expect.">
            <textarea id="description" {...register("description", { required: "Description is required" })} className={textareaClass} />
          </FieldWrapper>
          <FieldWrapper label="Category" name="category_id" error={errors.category_id} required tooltip="Select the most relevant category for your service.">
            <select id="category_id" {...register("category_id", { required: "Category is required" })} className={inputClass} disabled={loadingCategories}>
              <option value="">{loadingCategories ? "Loading categories..." : "Select a category"}</option>
              {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
            </select>
          </FieldWrapper>
        </FormSection>

        <FormSection title="Location" icon={<MapPin className="h-6 w-6 text-blue-600" />} tooltip="Where does your service take place?">
          <FieldWrapper label="City" name="custom_location.city" error={errors.custom_location?.city} tooltip="The main city where the service is offered.">
            <input type="text" id="custom_location.city" {...register("custom_location.city")} className={inputClass} />
          </FieldWrapper>
          <FieldWrapper label="Country" name="custom_location.country" error={errors.custom_location?.country} tooltip="The country where the service is offered.">
            <input type="text" id="custom_location.country" {...register("custom_location.country")} className={inputClass} />
          </FieldWrapper>
           <FieldWrapper label="Address / Meeting Point" name="custom_location.address" error={errors.custom_location?.address} tooltip="Specific address or meeting point details.">
            <input type="text" id="custom_location.address" {...register("custom_location.address")} className={inputClass} />
          </FieldWrapper>
        </FormSection>

        <FormSection title="Pricing" icon={<DollarSign className="h-6 w-6 text-blue-600" />} tooltip="Set the price for your service.">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FieldWrapper label="Base Price" name="base_price" error={errors.base_price} required tooltip="The standard price per person or per service.">
              <input type="number" id="base_price" {...register("base_price", { required: "Base price is required", valueAsNumber: true, min: { value: 0, message: "Price must be positive" } })} className={inputClass} step="0.01" />
            </FieldWrapper>
            <FieldWrapper label="Currency" name="currency" error={errors.currency} required tooltip="The currency for your pricing.">
              <select id="currency" {...register("currency", { required: "Currency is required" })} className={inputClass}>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
              </select>
            </FieldWrapper>
          </div>
        </FormSection>

        <FormSection title="Service Details" icon={<Tag className="h-6 w-6 text-blue-600" />} tooltip="Specifics about duration, group size, and type of service.">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FieldWrapper label="Duration (Hours)" name="duration_hours" error={errors.duration_hours} tooltip="Total duration of the service in hours, if applicable. Leave blank if multi-day.">
              <input type="number" id="duration_hours" {...register("duration_hours", { valueAsNumber: true, min: { value: 0, message: "Duration must be positive" } })} className={inputClass} />
            </FieldWrapper>
            <FieldWrapper label="Max Travelers" name="max_travelers" error={errors.max_travelers} tooltip="Maximum number of travelers allowed for this service. Leave blank for no limit.">
              <input type="number" id="max_travelers" {...register("max_travelers", { valueAsNumber: true, min: { value: 1, message: "Must allow at least 1 traveler" } })} className={inputClass} />
            </FieldWrapper>
          </div>
          <div className="mt-4 space-y-2">
            <label className="flex items-center">
              <input type="checkbox" {...register("is_multi_day")} className="form-checkbox h-4 w-4 text-blue-600 rounded mr-2" />
              Is this a multi-day service/trip?
            </label>
            {isMultiDay && (
              <FieldWrapper label="Total Days" name="total_days" error={errors.total_days} required={isMultiDay} tooltip="Total number of days for the multi-day service.">
                <input type="number" id="total_days" {...register("total_days", { required: isMultiDay ? "Total days are required for multi-day services" : false, valueAsNumber: true, min: { value: 1, message: "Must be at least 1 day" } })} className={inputClass} />
              </FieldWrapper>
            )}
            <label className="flex items-center">
              <input type="checkbox" {...register("is_customizable")} className="form-checkbox h-4 w-4 text-blue-600 rounded mr-2" />
              Is this service customizable by travelers?
            </label>
             <label className="flex items-center">
              <input type="checkbox" {...register("is_example_itinerary")} className="form-checkbox h-4 w-4 text-blue-600 rounded mr-2" />
              Is this an example itinerary (template for customization)?
            </label>
          </div>
        </FormSection>

        <FormSection title="Itinerary (for multi-day or structured services)" icon={<CalendarCheck className="h-6 w-6 text-blue-600" />} tooltip="Outline the day-by-day plan. Add items as needed.">
          {itineraryFields.map((field, index) => (
            <div key={field.id} className="p-3 border rounded-md bg-gray-50 space-y-2 relative">
              <FieldWrapper label={`Day ${index + 1} - Title`} name={`itinerary.${index}.title`} error={errors.itinerary?.[index]?.title} required>
                <input type="text" {...register(`itinerary.${index}.title`, { required: "Day title is required" })} className={inputClass} placeholder="e.g., Arrival & City Exploration" />
              </FieldWrapper>
              <FieldWrapper label={`Day ${index + 1} - Description`} name={`itinerary.${index}.description`} error={errors.itinerary?.[index]?.description} required>
                <textarea {...register(`itinerary.${index}.description`, { required: "Day description is required" })} className={textareaClass} placeholder="Detailed activities for the day." />
              </FieldWrapper>
              {itineraryFields.length > 1 && (
                <button type="button" onClick={() => removeItinerary(index)} className="absolute top-2 right-2 text-red-500 hover:text-red-700 p-1">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
          <button type="button" onClick={() => appendItinerary({ day_number: itineraryFields.length + 1, title: '', description: '' })} className="mt-2 text-sm flex items-center text-blue-600 hover:text-blue-800 font-medium">
            <PlusCircle className="h-5 w-5 mr-1" /> Add Itinerary Day
          </button>
        </FormSection>

        <FormSection title="Inclusions" icon={<CheckSquare className="h-6 w-6 text-blue-600" />} tooltip="List what is included in the price (e.g., meals, accommodation, tickets).">
          {inclusionFields.map((field, index) => (
            <div key={field.id} className="flex items-center space-x-2">
              <input type="text" {...register(`inclusions.${index}.value`)} className={inputClass + " flex-grow"} placeholder="e.g., Airport transfers" />
              {inclusionFields.length > 1 && (
                <button type="button" onClick={() => removeInclusion(index)} className="text-red-500 hover:text-red-700 p-1">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
          <button type="button" onClick={() => appendInclusion({ value: '' })} className="mt-2 text-sm flex items-center text-blue-600 hover:text-blue-800 font-medium">
            <PlusCircle className="h-5 w-5 mr-1" /> Add Inclusion
          </button>
        </FormSection>

        <FormSection title="Exclusions" icon={<XSquare className="h-6 w-6 text-blue-600" />} tooltip="List what is NOT included in the price (e.g., international flights, visa fees).">
          {exclusionFields.map((field, index) => (
            <div key={field.id} className="flex items-center space-x-2">
              <input type="text" {...register(`exclusions.${index}.value`)} className={inputClass + " flex-grow"} placeholder="e.g., Personal travel insurance" />
              {exclusionFields.length > 1 && (
                <button type="button" onClick={() => removeExclusion(index)} className="text-red-500 hover:text-red-700 p-1">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
          <button type="button" onClick={() => appendExclusion({ value: '' })} className="mt-2 text-sm flex items-center text-blue-600 hover:text-blue-800 font-medium">
            <PlusCircle className="h-5 w-5 mr-1" /> Add Exclusion
          </button>
        </FormSection>

        <FormSection title="Additional Information" icon={<FileText className="h-6 w-6 text-blue-600" />} tooltip="Important details like requirements and cancellation policies.">
          <FieldWrapper label="Requirements" name="requirements" error={errors.requirements} tooltip="Any specific requirements for travelers (e.g., fitness level, visa, equipment).">
            <textarea id="requirements" {...register("requirements")} className={textareaClass} />
          </FieldWrapper>
          <FieldWrapper label="Cancellation Policy" name="cancellation_policy" error={errors.cancellation_policy} tooltip="Clearly state your cancellation and refund policy.">
            <textarea id="cancellation_policy" {...register("cancellation_policy")} className={textareaClass} />
          </FieldWrapper>
        </FormSection>

        <FormSection title="Manage Media" icon={<UploadCloud className="h-6 w-6 text-blue-600" />} tooltip="Manage images/videos for your listing (max 10 files, 20MB each).">
          {/* Display Existing Media */}
          {existingMedia.length > 0 && (
            <div className="mb-4">
              <h4 className="text-md font-medium text-gray-700 mb-2">Current Media:</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {existingMedia.map((media) => (
                  <div key={media.id} className={`relative group border-2 rounded-md p-1 ${mediaToDelete.includes(media.id) ? 'border-red-500 opacity-50' : 'border-transparent'}`}>
                    {media.media_type === 'image' ? (
                      <img src={`${API_URL.replace('/api', '')}${media.url}`} alt={media.caption || 'Listing media'} className="w-full h-32 object-cover rounded-md" />
                    ) : (
                      <div className="w-full h-32 bg-gray-200 rounded-md flex flex-col items-center justify-center text-center p-2">
                        <VideoIconLucide className="h-8 w-8 text-gray-500 mb-1"/>
                        <p className="text-xs text-gray-600 truncate">{media.caption || 'Video'}</p>
                      </div>
                    )}
                    <button type="button" onClick={() => toggleDeleteExistingMedia(media.id)} className={`absolute top-1 right-1 text-white rounded-full p-0.5 transition-opacity 
                      ${mediaToDelete.includes(media.id) ? 'bg-red-700 hover:bg-red-800' : 'bg-red-500 hover:bg-red-600 opacity-0 group-hover:opacity-100'}`}>
                      <Trash2 className="h-3 w-3" />
                    </button>
                    {media.is_featured && <span className="absolute bottom-1 left-1 bg-yellow-400 text-yellow-800 text-xs px-1.5 py-0.5 rounded-sm">Featured</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Upload New Media */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Upload New Media</label>
            <input type="file" multiple accept="image/*,video/*" onChange={handleNewMediaChange} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
          </div>
          {newMediaPreviews.length > 0 && (
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {newMediaPreviews.map((file, index) => (
                <div key={index} className="relative group">
                  {file.type.startsWith('image/') ? (
                    <img src={file.url} alt={file.name} className="w-full h-32 object-cover rounded-md" />
                  ) : (
                    <div className="w-full h-32 bg-gray-200 rounded-md flex flex-col items-center justify-center text-center p-2">
                       <VideoIconLucide className="h-8 w-8 text-gray-500 mb-1"/>
                       <p className="text-xs text-gray-600 truncate">{file.name}</p>
                    </div>
                  )}
                  <button type="button" onClick={() => removeNewMediaPreview(index)} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </FormSection>

        <FormSection title="Status" icon={<CheckSquare className="h-6 w-6 text-blue-600" />} tooltip="Set the visibility of your listing.">
          <FieldWrapper label="Listing Status" name="status" error={errors.status} required>
            <select id="status" {...register("status", { required: "Status is required" })} className={inputClass}>
              <option value="draft">Draft (Save for later, not visible to public)</option>
              <option value="published">Published (Visible to public and bookable)</option>
              <option value="archived">Archived (Not visible, kept for records)</option>
            </select>
          </FieldWrapper>
        </FormSection>

        <div className="pt-5">
          <div className="flex justify-end space-x-3">
            <button type="button" onClick={() => navigate('/provider/dashboard')} className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
              Cancel
            </button>
            <button type="submit" disabled={loadingSubmit} className="inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50">
              {loadingSubmit ? <Loader2 className="animate-spin h-5 w-5 mr-2" /> : null}
              {loadingSubmit ? 'Saving Changes...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default EditListingForm;
