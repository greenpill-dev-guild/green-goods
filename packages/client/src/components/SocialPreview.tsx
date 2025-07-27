import { useEffect } from "react";
import { useLocation, useParams } from "react-router-dom";
import { useGardens } from "@/providers/garden";

interface MetaTags {
  title: string;
  description: string;
  image?: string;
  url: string;
  type?: string;
}

const updateMetaTags = (tags: MetaTags) => {
  // Update document title
  document.title = tags.title;

  // Helper function to update or create meta tags
  const updateMetaTag = (property: string, content: string, isProperty = true) => {
    const attribute = isProperty ? 'property' : 'name';
    let meta = document.querySelector(`meta[${attribute}="${property}"]`);
    
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute(attribute, property);
      document.head.appendChild(meta);
    }
    
    meta.setAttribute('content', content);
  };

  // Update basic meta tags
  updateMetaTag('description', tags.description, false);
  
  // Update Open Graph tags
  updateMetaTag('og:title', tags.title);
  updateMetaTag('og:description', tags.description);
  updateMetaTag('og:url', tags.url);
  updateMetaTag('og:type', tags.type || 'website');
  
  if (tags.image) {
    updateMetaTag('og:image', tags.image);
    updateMetaTag('og:image:alt', `Image for ${tags.title}`);
  }
  
  // Update Twitter Card tags
  updateMetaTag('twitter:title', tags.title, false);
  updateMetaTag('twitter:description', tags.description, false);
  updateMetaTag('twitter:card', tags.image ? 'summary_large_image' : 'summary', false);
  
  if (tags.image) {
    updateMetaTag('twitter:image', tags.image, false);
  }
};

const getDefaultMetaTags = (pathname: string): MetaTags => {
  const baseUrl = window.location.origin;
  
  switch (true) {
    case pathname.includes('/garden'):
      return {
        title: 'Green Goods - Garden',
        description: 'Explore sustainable gardens and biodiversity projects on Green Goods',
        url: `${baseUrl}${pathname}`,
        type: 'website'
      };
    case pathname.includes('/work'):
      return {
        title: 'Green Goods - Garden Work',
        description: 'View garden work and sustainability contributions on Green Goods',
        url: `${baseUrl}${pathname}`,
        type: 'website'
      };
    case pathname.includes('/profile'):
      return {
        title: 'Green Goods - Profile',
        description: 'User profile and gardening achievements on Green Goods',
        url: `${baseUrl}${pathname}`,
        type: 'profile'
      };
    default:
      return {
        title: 'Green Goods - Bringing Biodiversity Onchain',
        description: 'Join the movement to bring biodiversity onchain. Track, verify, and reward sustainable gardening practices.',
        url: `${baseUrl}${pathname}`,
        type: 'website'
      };
  }
};

export const SocialPreview: React.FC = () => {
  const location = useLocation();
  const params = useParams();
  const { gardens } = useGardens();
  
  // Get garden data if we're on a garden route
  const gardenId = params.gardenId || params.id;
  const garden = gardenId ? gardens.find(g => g.id === gardenId) : null;
  
  // Get work data if we're on a work route
  const workId = params.workId;
  
  useEffect(() => {
    const pathname = location.pathname;
    const baseUrl = window.location.origin;
    
    let metaTags: MetaTags;
    
    // Generate specific meta tags based on route and data
    if (garden && pathname.includes('/share/garden')) {
      // Shared garden link
      metaTags = {
        title: `${garden.name} - Green Goods Garden`,
        description: garden.description || `Explore ${garden.name} garden in ${garden.location}. Join the sustainable gardening community on Green Goods.`,
        image: garden.bannerImage || `${baseUrl}/social-image.webp`,
        url: `${baseUrl}${pathname}`,
        type: 'website'
      };
    } else if (garden && workId && pathname.includes('/share/garden')) {
      // Shared work link
      metaTags = {
        title: `Garden Work at ${garden.name} - Green Goods`,
        description: `View sustainable gardening work at ${garden.name} in ${garden.location}. Track biodiversity and environmental impact on Green Goods.`,
        image: garden.bannerImage || `${baseUrl}/social-image.webp`,
        url: `${baseUrl}${pathname}`,
        type: 'website'
      };
    } else if (garden && pathname.includes('/home/')) {
      // Regular garden view in app
      metaTags = {
        title: `${garden.name} - Green Goods`,
        description: garden.description || `Managing ${garden.name} garden in ${garden.location}`,
        image: garden.bannerImage || `${baseUrl}/social-image.webp`,
        url: `${baseUrl}${pathname}`,
        type: 'website'
      };
    } else {
      // Default meta tags based on route
      metaTags = getDefaultMetaTags(pathname);
    }
    
    updateMetaTags(metaTags);
  }, [location.pathname, garden, workId]);

  // This component doesn't render anything visible
  return null;
};

// Hook for getting current meta information
export const useCurrentMeta = () => {
  const location = useLocation();
  const params = useParams();
  const { gardens } = useGardens();
  
  const gardenId = params.gardenId || params.id;
  const garden = gardenId ? gardens.find(g => g.id === gardenId) : null;
  const workId = params.workId;
  
  const generateShareUrl = (type: 'garden' | 'work') => {
    const baseUrl = window.location.origin;
    
    if (type === 'garden' && garden) {
      return `${baseUrl}/share/garden/${garden.id}?shared=true`;
    }
    
    if (type === 'work' && garden && workId) {
      return `${baseUrl}/share/garden/${garden.id}/work/${workId}?shared=true`;
    }
    
    return `${baseUrl}${location.pathname}`;
  };
  
  const generateMetaForSharing = (type: 'garden' | 'work') => {
    const baseUrl = window.location.origin;
    
    if (type === 'garden' && garden) {
      return {
        title: `${garden.name} - Green Goods Garden`,
        description: garden.description || `Explore ${garden.name} garden in ${garden.location}. Join the sustainable gardening community on Green Goods.`,
        image: garden.bannerImage || `${baseUrl}/social-image.webp`,
        url: generateShareUrl('garden')
      };
    }
    
    if (type === 'work' && garden && workId) {
      return {
        title: `Garden Work at ${garden.name} - Green Goods`,
        description: `View sustainable gardening work at ${garden.name} in ${garden.location}. Track biodiversity and environmental impact on Green Goods.`,
        image: garden.bannerImage || `${baseUrl}/social-image.webp`,
        url: generateShareUrl('work')
      };
    }
    
    return getDefaultMetaTags(location.pathname);
  };
  
  return {
    garden,
    workId,
    generateShareUrl,
    generateMetaForSharing,
    currentPath: location.pathname
  };
};

export default SocialPreview;