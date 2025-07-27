# React Router v7 Routing Architecture Improvements

This document outlines the comprehensive routing improvements implemented in the Green Goods application using React Router v7.

## 🚀 Key Features Implemented

### 1. Persistent Link Handling
- **No automatic redirects**: Users entering direct links are not automatically redirected away
- **Session-based navigation**: Navigation state is preserved across page refreshes
- **Deep link support**: Shared links maintain their intended destination

### 2. Enhanced Deep Linking
- **Shareable garden links**: `/share/garden/{id}?shared=true`
- **Shareable work links**: `/share/garden/{id}/work/{workId}?shared=true`
- **Device-aware redirects**: Desktop users are directed to mobile when appropriate
- **App detection**: Automatic attempt to open native app on mobile devices

### 3. Improved Suspense & Loading States
- **Route-level loading**: Each route has its own loading state with accessibility features
- **Contextual messages**: Loading messages are specific to the content being loaded
- **ARIA support**: Screen readers announce loading states properly

### 4. Accessibility Enhancements
- **ARIA labels**: All navigation elements have proper accessibility labels
- **Screen reader support**: Loading states and navigation changes are announced
- **Keyboard navigation**: Full keyboard support for all routing interactions
- **Focus management**: Proper focus handling during route transitions

### 5. Social Preview & SEO
- **Dynamic meta tags**: Meta tags update based on route and content
- **Open Graph support**: Rich social media previews for shared content
- **Structured data**: JSON-LD structured data for search engines
- **Twitter Cards**: Optimized Twitter sharing experience

## 📁 File Structure

```
src/
├── routes/
│   └── index.tsx                    # Main router configuration
├── components/
│   ├── ErrorBoundary.tsx           # Error handling
│   ├── SocialPreview.tsx           # Dynamic meta tags
│   ├── DeviceRedirect.tsx          # Mobile/desktop handling
│   ├── Navigation/
│   │   └── PersistentLink.tsx      # Link persistence
│   └── UI/
│       └── ShareButton.tsx         # Social sharing
└── utils/
    └── ssr-helper.ts               # Server-side rendering utils
```

## 🔧 Route Configuration

### Main Routes
- `/` - App root (redirects based on auth state)
- `/home` - Main dashboard with nested garden routes
- `/garden` - Garden creation/management
- `/profile` - User profile
- `/landing` - Landing page for non-installed apps
- `/login` - Authentication

### Shared Content Routes
- `/share/garden/{id}` - Public garden view
- `/share/garden/{id}/work/{workId}` - Public work view

### Route Data Loaders
```typescript
export const gardenLoader = async ({ params, request }) => {
  const { gardenId } = params;
  const url = new URL(request.url);
  const isSharedLink = url.searchParams.get('shared') === 'true';
  
  return {
    gardenId,
    isSharedLink,
    timestamp: Date.now()
  };
};
```

## 🎯 Usage Examples

### Sharing a Garden
```typescript
import { ShareButton } from '@/components/UI/ShareButton';

<ShareButton 
  type="garden"
  title="Check out this amazing garden!"
  description="Sustainable gardening at its finest"
/>
```

### Using Persistent Links
```typescript
import { PersistentLink } from '@/components/Navigation/PersistentLink';

<PersistentLink 
  to="/garden/123"
  preventRedirect={true}
>
  View Garden
</PersistentLink>
```

### Generating Share URLs
```typescript
import { useCurrentMeta } from '@/components/SocialPreview';

const { generateShareUrl } = useCurrentMeta();
const shareUrl = generateShareUrl('garden'); // Generates shareable URL
```

## 🔄 Migration from React Router v6

### Before (v6)
```tsx
<BrowserRouter>
  <Routes>
    <Route path="/garden/:id" element={<Garden />} />
  </Routes>
</BrowserRouter>
```

### After (v7)
```tsx
const router = createAppRouter(queryClient, authState);

<RouterProvider router={router} />
```

## 📱 Device Detection & Redirects

### Mobile App Detection
- Detects if user has the mobile app installed
- Attempts to open app using custom URL schemes
- Falls back to app store links if app not installed

### Banner System
```typescript
const AppInstallBanner = ({ deviceInfo, onClose }) => {
  // Shows contextual install prompts
  // Handles app store redirects
  // Manages user dismissal state
};
```

## 🔍 SEO & Social Features

### Dynamic Meta Tags
```typescript
const updateMetaTags = (tags: MetaTags) => {
  document.title = tags.title;
  
  // Updates Open Graph tags
  updateMetaTag('og:title', tags.title);
  updateMetaTag('og:description', tags.description);
  updateMetaTag('og:image', tags.image);
  
  // Updates Twitter Cards
  updateMetaTag('twitter:title', tags.title, false);
  updateMetaTag('twitter:card', 'summary_large_image', false);
};
```

### Structured Data
```json
{
  "@context": "https://schema.org",
  "@type": "Place",
  "name": "Garden Name",
  "description": "Garden description",
  "address": {
    "@type": "PostalAddress",
    "addressLocality": "Garden Location"
  }
}
```

## 🛡️ Error Handling

### React Error Boundary
- Catches routing errors and JavaScript exceptions
- Provides user-friendly error messages
- Offers recovery options (refresh, go home)
- Includes development-mode error details

### Route Error Handling
```typescript
export function RouterErrorBoundary() {
  const error = useRouteError();
  
  if (isRouteErrorResponse(error)) {
    switch (error.status) {
      case 404:
        return <NotFoundPage />;
      case 403:
        return <UnauthorizedPage />;
      default:
        return <GenericErrorPage />;
    }
  }
}
```

## 🎨 Loading States

### Route-Level Suspense
```typescript
const RouteLoader = ({ message = "Loading..." }) => (
  <div 
    role="status"
    aria-live="polite"
    aria-label={message}
  >
    <CircleLoader />
    <span className="sr-only">{message}</span>
  </div>
);
```

### Contextual Loading Messages
- "Loading dashboard..." for home route
- "Loading garden details..." for garden routes  
- "Loading work details..." for work routes
- "Loading shared content..." for public routes

## 📊 Performance Optimizations

### Code Splitting
```typescript
const Home = lazy(() => import("@/views/Home"));
const Garden = lazy(() => import("@/views/Garden"));
const Profile = lazy(() => import("@/views/Profile"));
```

### Data Preloading
- Route loaders fetch critical data before rendering
- Session storage caches navigation state
- Lazy loading for non-critical components

## 🧪 Testing Considerations

### Route Testing
```typescript
// Test direct link access
test('should preserve direct garden link', () => {
  render(<App />, { 
    initialEntries: ['/share/garden/123?shared=true'] 
  });
  
  expect(screen.getByText('Garden Details')).toBeInTheDocument();
});
```

### Share Functionality Testing
```typescript
// Test share button
test('should copy link to clipboard', async () => {
  const user = userEvent.setup();
  render(<ShareButton type="garden" />);
  
  await user.click(screen.getByRole('button', { name: /share/i }));
  
  expect(navigator.clipboard.writeText).toHaveBeenCalled();
});
```

## 🔧 Configuration

### Environment Variables
```env
VITE_DESKTOP_DEV=true              # Enable desktop dev mode
VITE_APP_SCHEME=greengoods         # Custom URL scheme
VITE_APP_STORE_ID=greengoods-app   # App store ID
```

### Vite Configuration
Ensure proper handling of routing in `vite.config.ts`:
```typescript
export default defineConfig({
  // ... other config
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom']
        }
      }
    }
  }
});
```

## 🚀 Deployment Considerations

### Server Configuration
Ensure your server handles client-side routing:
```nginx
location / {
  try_files $uri $uri/ /index.html;
}
```

### Social Media Preview
- Ensure all social image assets are properly served
- Configure proper CORS headers for external preview services
- Test sharing on multiple platforms (Facebook, Twitter, LinkedIn)

## 📈 Monitoring & Analytics

### Track Route Performance
```typescript
// Add to route loaders
const startTime = performance.now();
// ... load data
const loadTime = performance.now() - startTime;
analytics.track('route_load_time', { route: path, duration: loadTime });
```

### Track Share Events
```typescript
const handleShare = async () => {
  analytics.track('content_shared', {
    type: 'garden',
    gardenId: garden?.id,
    platform: 'native'
  });
  
  await shareContent();
};
```

## 🔄 Future Improvements

### Planned Features
1. **Offline Support**: PWA caching for shared routes
2. **Advanced Analytics**: Route-level performance monitoring
3. **A/B Testing**: Route-level experimentation framework
4. **Internationalization**: Route-based language switching

### Potential Optimizations
1. **Route-based code splitting**: More granular lazy loading
2. **Predictive prefetching**: Preload likely next routes
3. **Service Worker integration**: Background route caching
4. **Advanced error recovery**: Automatic retry mechanisms

---

## 📝 Summary

This routing architecture provides:
- ✅ Persistent link handling without unwanted redirects
- ✅ Comprehensive deep linking for gardens and work
- ✅ Enhanced loading states with accessibility
- ✅ Social media optimization with dynamic meta tags
- ✅ Mobile-first design with app integration
- ✅ Robust error handling and recovery
- ✅ Performance optimizations and code splitting

The implementation follows React Router v7 best practices and provides a foundation for scalable, accessible, and user-friendly navigation throughout the Green Goods application.