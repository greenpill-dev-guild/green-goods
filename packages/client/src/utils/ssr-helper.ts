// Server-side rendering helper for shared links and SEO
// This can be used with SSR frameworks or static generation

interface SEOData {
  title: string;
  description: string;
  image?: string;
  url: string;
  type: string;
  garden?: Garden;
  work?: Work;
}

export const generateStaticMeta = (
  path: string, 
  baseUrl: string, 
  data?: { garden?: Garden; work?: Work }
): SEOData => {
  const { garden, work } = data || {};

  // Default SEO data
  const defaultSEO: SEOData = {
    title: "Green Goods - Bringing Biodiversity Onchain",
    description: "Join the movement to bring biodiversity onchain. Track, verify, and reward sustainable gardening practices.",
    image: `${baseUrl}/social-image.webp`,
    url: `${baseUrl}${path}`,
    type: "website"
  };

  // Route-specific SEO data
  if (path.includes('/share/garden/') && garden) {
    if (work) {
      // Shared work link
      return {
        title: `Garden Work at ${garden.name} - Green Goods`,
        description: `View sustainable gardening work at ${garden.name} in ${garden.location}. Track biodiversity and environmental impact on Green Goods.`,
        image: garden.bannerImage || defaultSEO.image,
        url: `${baseUrl}${path}`,
        type: "article",
        garden,
        work
      };
    } else {
      // Shared garden link
      return {
        title: `${garden.name} - Green Goods Garden`,
        description: garden.description || `Explore ${garden.name} garden in ${garden.location}. Join the sustainable gardening community on Green Goods.`,
        image: garden.bannerImage || defaultSEO.image,
        url: `${baseUrl}${path}`,
        type: "website",
        garden
      };
    }
  }

  // Route-based defaults
  if (path.includes('/garden')) {
    return {
      ...defaultSEO,
      title: "Green Goods - Garden",
      description: "Explore sustainable gardens and biodiversity projects on Green Goods"
    };
  }

  if (path.includes('/profile')) {
    return {
      ...defaultSEO,
      title: "Green Goods - Profile",
      description: "User profile and gardening achievements on Green Goods",
      type: "profile"
    };
  }

  return defaultSEO;
};

// Generate structured data for rich snippets
export const generateStructuredData = (seoData: SEOData) => {
  const baseStructuredData = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "Green Goods",
    "description": "Bringing Biodiversity Onchain",
    "url": seoData.url,
    "applicationCategory": "EnvironmentalApplication",
    "operatingSystem": "All"
  };

  if (seoData.garden) {
    // Add Garden-specific structured data
    const gardenStructuredData = {
      "@context": "https://schema.org",
      "@type": "Place",
      "name": seoData.garden.name,
      "description": seoData.garden.description,
      "address": {
        "@type": "PostalAddress",
        "addressLocality": seoData.garden.location
      },
      "image": seoData.garden.bannerImage,
      "url": seoData.url
    };

    if (seoData.work) {
      // Add Work-specific structured data
      return {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": seoData.title,
        "description": seoData.description,
        "image": seoData.image,
        "url": seoData.url,
        "author": {
          "@type": "Organization",
          "name": "Green Goods"
        },
        "publisher": {
          "@type": "Organization",
          "name": "Green Goods"
        },
        "about": gardenStructuredData
      };
    }

    return [baseStructuredData, gardenStructuredData];
  }

  return baseStructuredData;
};

// Generate HTML meta tags for SSR
export const generateMetaTags = (seoData: SEOData): string => {
  const structuredData = generateStructuredData(seoData);
  
  return `
    <!-- Basic Meta Tags -->
    <title>${seoData.title}</title>
    <meta name="description" content="${seoData.description}" />
    
    <!-- Open Graph Meta Tags -->
    <meta property="og:title" content="${seoData.title}" />
    <meta property="og:description" content="${seoData.description}" />
    <meta property="og:image" content="${seoData.image || ''}" />
    <meta property="og:url" content="${seoData.url}" />
    <meta property="og:type" content="${seoData.type}" />
    <meta property="og:site_name" content="Green Goods" />
    
    <!-- Twitter Card Meta Tags -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${seoData.title}" />
    <meta name="twitter:description" content="${seoData.description}" />
    <meta name="twitter:image" content="${seoData.image || ''}" />
    <meta name="twitter:site" content="@greengoodsapp" />
    
    <!-- Structured Data -->
    <script type="application/ld+json">
      ${JSON.stringify(structuredData, null, 2)}
    </script>
    
    <!-- Mobile App Links -->
    <meta name="apple-itunes-app" content="app-id=greengoods-app" />
    <meta name="google-play-app" content="app-id=com.greengoods.app" />
    
    <!-- Canonical URL -->
    <link rel="canonical" href="${seoData.url}" />
  `.trim();
};

// Function to preload critical route data
export const preloadRouteData = async (path: string) => {
  // Extract route parameters
  const gardenMatch = path.match(/\/(?:share\/)?garden\/([^\/]+)/);
  const workMatch = path.match(/\/work\/([^\/]+)/);
  
  if (gardenMatch) {
    const gardenId = gardenMatch[1];
    
    try {
      // In a real implementation, these would be actual API calls
      // const garden = await fetchGarden(gardenId);
      // const work = workMatch ? await fetchWork(workMatch[1]) : null;
      
      // For now, return mock data structure
      return {
        garden: {
          id: gardenId,
          name: "Sample Garden",
          location: "Sample Location", 
          description: "A beautiful sustainable garden",
          bannerImage: "/garden-default.jpg"
        },
        work: workMatch ? {
          id: workMatch[1],
          title: "Garden Work",
          description: "Sustainable gardening work"
        } : null
      };
    } catch (error) {
      console.error("Failed to preload route data:", error);
      return null;
    }
  }
  
  return null;
};

// Utility for generating share URLs
export const generateShareURL = (
  path: string, 
  baseUrl: string, 
  platform: 'facebook' | 'twitter' | 'linkedin' | 'whatsapp' = 'facebook'
): string => {
  const shareUrl = `${baseUrl}/share${path}?shared=true`;
  const encodedUrl = encodeURIComponent(shareUrl);
  
  switch (platform) {
    case 'facebook':
      return `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
    case 'twitter':
      return `https://twitter.com/intent/tweet?url=${encodedUrl}`;
    case 'linkedin':
      return `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
    case 'whatsapp':
      return `https://wa.me/?text=${encodedUrl}`;
    default:
      return shareUrl;
  }
};

export default {
  generateStaticMeta,
  generateStructuredData,
  generateMetaTags,
  preloadRouteData,
  generateShareURL
};