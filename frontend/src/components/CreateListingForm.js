import React, { useState, useEffect } from 'react';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-toastify';
import { PlusCircle, Trash2, Info, Loader2, UploadCloud, X, DollarSign, Clock, Users, Tag, MapPin, FileText, CheckSquare, XSquare, CalendarCheck, HelpCircle, Eye } from 'lucide-react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const CreateListingForm = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [formError, setFormError] = useState(null);
  const [mediaPreviews, setMediaPreviews] = useState([]);
  const [mediaFiles, setMediaFiles] = useState([]);

  const { register, handleSubmit, control, watch, formState: { errors }, reset } = useForm({
    defaultValues: {
      title: '',
      description: '',
      category_id: '',
      custom_location: { city: '', country: '', address: '' }, // Simplified location
      base_price: '',
      currency: 'USD',
      duration_hours: null,
      is_multi_day: false,
      total_days: null,
      max_travelers: null,
      is_customizable: false,
      is_example_itinerary: false,
      inclusions: [{ value: '' }],
      exclusions: [{ value: '' }],
      itinerary: [{ day_number: 1, title: '', description: '' }],
      requirements: '',
      cancellation_policy: '',
      status: 'draft',
      // tags: [{ value: '' }], // Simplified: tags not explicitly in schema, can be part of description or a new field later
    },
  });

  const { fields: inclusionFields, append: appendInclusion, remove: removeInclusion } = useFieldArray({ control, name: "inclusions" });
  const { fields: exclusionFields, append: appendExclusion, remove: removeExclusion } = useFieldArray({ control, name: "exclusions" });
  const { fields: itineraryFields, append: appendItinerary, remove: removeItinerary } = useFieldArray({ control, name: "itinerary" });

  const isMultiDay = watch('is_multi_day');

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

  const handleMediaChange = (event) => {
    const files = Array.from(event.target.files);
    setMediaFiles(prevFiles => [...prevFiles, ...files].slice(0, 10)); // Limit to 10 files

    const newPreviews = files.map(file => ({
        name: file.name,
        url: URL.createObjectURL(file),
        type: file.type
    })).slice(0, 10 - mediaPreviews.length); // Ensure total previews don't exceed limit

    setMediaPreviews(prevPreviews => [...prevPreviews, ...newPreviews]);
  };
  
  const removeMediaPreview = (index) => {
    setMediaPreviews(prev => prev.filter((_, i) => i !== index));
    setMediaFiles(prev => prev.filter((_, i) => i !== index));
    // Reset file input if needed, though this is tricky with controlled inputs
    // For simplicity, user might need to re-select if they remove and want to add more than the original selection.
  };

  useEffect(() => {
    // Clean up Object URLs
    return () => {
      mediaPreviews.forEach(file => URL.revokeObjectURL(file.url));
    };
  }, [mediaPreviews]);


  const onSubmit = async (data) => {
    if (!token) {
      toast.error("Authentication error. Please log in again.");
      return;
    }
    setLoadingSubmit(true);
    setFormError(null);

    const formData = new FormData();
    
    // Append all simple fields
    Object.keys(data).forEach(key => {
      if (key === 'inclusions' || key === 'exclusions' || key === 'itinerary' || key === 'custom_location') {
        // Handle arrays/objects separately
      } else if (data[key] !== null && data[key] !== undefined) {
        formData.append(key, data[key]);
      }
    });

    // Append structured data as JSON strings
    formData.append('custom_location', JSON.stringify(data.custom_location));
    formData.append('inclusions', JSON.stringify(data.inclusions.map(item => item.value).filter(Boolean)));
    formData.append('exclusions', JSON.stringify(data.exclusions.map(item => item.value).filter(Boolean)));
    formData.append('itinerary', JSON.stringify(data.itinerary.filter(item => item.title && item.description)));

    // Append media files
    mediaFiles.forEach(file => {
      formData.append('mediaFiles', file); // Backend expects 'mediaFiles'
    });
    
    // Log formData entries for debugging (remove in production)
    // for (let [key, value] of formData.entries()) {
    //   console.log(`${key}:`, value);
    // }

    try {
      const response = await axios.post(`${API_URL}/providers/listings`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      });
      toast.success('Listing created successfully!');
      reset(); // Reset form fields
      setMediaFiles([]);
      setMediaPreviews([]);
      navigate('/provider/dashboard'); // Or to the new listing's page: `/listing/${response.data.id}`
    } catch (error) {
      console.error("Error creating listing:", error.response?.data || error.message);
      const errMsg = error.response?.data?.message || "Failed to create listing. Please check your input.";
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

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 bg-gray-50">
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-6">Create New Service Listing</h1>
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
                {/* Add more currencies as needed */}
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

        <FormSection title="Media Upload" icon={<UploadCloud className="h-6 w-6 text-blue-600" />} tooltip="Upload images or videos for your listing (max 10 files, 20MB each).">
          <input type="file" multiple accept="image/*,video/*" onChange={handleMediaChange} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
          {mediaPreviews.length > 0 && (
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {mediaPreviews.map((file, index) => (
                <div key={index} className="relative group">
                  {file.type.startsWith('image/') ? (
                    <img src={file.url} alt={file.name} className="w-full h-32 object-cover rounded-md" />
                  ) : (
                    <div className="w-full h-32 bg-gray-200 rounded-md flex flex-col items-center justify-center text-center p-2">
                       <Eye className="h-8 w-8 text-gray-500 mb-1"/>
                       <p className="text-xs text-gray-600 truncate">{file.name}</p>
                       <p className="text-xs text-gray-400">(Video Preview)</p>
                    </div>
                  )}
                  <button type="button" onClick={() => removeMediaPreview(index)} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
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
              {loadingSubmit ? 'Saving...' : 'Create Listing'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default CreateListingForm;
