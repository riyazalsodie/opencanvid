export interface WallpaperItem {
  id: string;
  name: string;
  category: 'windows' | 'mac' | 'canvid';
  thumbnailUrl: string;
  fullUrl: string;
}

export const CANVID_WALLPAPERS: WallpaperItem[] = [
  // Windows Official Bloom Wallpapers
  {
    id: 'win11-dark-blue',
    name: 'Windows 11 Bloom Dark',
    category: 'windows',
    thumbnailUrl: './wallpapers/system/thumbs/windows-11-dark-mode-blue-stock-official-3840x2400-5630.avif',
    fullUrl: './wallpapers/system/windows-11-dark-mode-blue-stock-official-3840x2400-5630.avif',
  },
  {
    id: 'win11-light-blue',
    name: 'Windows 11 Bloom Light',
    category: 'windows',
    thumbnailUrl: './wallpapers/system/thumbs/windows-11-blue-stock-white-background-light-official-3840x2400-5616.avif',
    fullUrl: './wallpapers/system/windows-11-blue-stock-white-background-light-official-3840x2400-5616.avif',
  },
  {
    id: 'win11-colorful-dark',
    name: 'Windows 11 Ribbon Dark',
    category: 'windows',
    thumbnailUrl: './wallpapers/system/thumbs/windows-11-stock-official-colorful-3840x2160-5658.avif',
    fullUrl: './wallpapers/system/windows-11-stock-official-colorful-3840x2160-5658.avif',
  },
  {
    id: 'win11-colorful-light',
    name: 'Windows 11 Ribbon Light',
    category: 'windows',
    thumbnailUrl: './wallpapers/system/thumbs/windows-11-stock-official-colorful-3840x2160-5663.avif',
    fullUrl: './wallpapers/system/windows-11-stock-official-colorful-3840x2160-5663.avif',
  },
  {
    id: 'win11-minimal-black',
    name: 'Windows 11 OLED Black',
    category: 'windows',
    thumbnailUrl: './wallpapers/system/thumbs/windows-11-dark-mode-stock-official-black-background-3841x2400-5653.avif',
    fullUrl: './wallpapers/system/windows-11-dark-mode-stock-official-black-background-3841x2400-5653.avif',
  },
  {
    id: 'win11-frost',
    name: 'Windows 11 Frost Bloom',
    category: 'windows',
    thumbnailUrl: './wallpapers/system/thumbs/windows-11-stock-official-light-3840x2400-5655.avif',
    fullUrl: './wallpapers/system/windows-11-stock-official-light-3840x2400-5655.avif',
  },

  // macOS Official Wallpapers
  {
    id: 'mac-sequoia-dark',
    name: 'macOS Sequoia Dark',
    category: 'mac',
    thumbnailUrl: './wallpapers/system/thumbs/15-Sequoia-Dark-16x9.avif',
    fullUrl: './wallpapers/system/15-Sequoia-Dark-16x9.avif',
  },
  {
    id: 'mac-sequoia-light',
    name: 'macOS Sequoia Light',
    category: 'mac',
    thumbnailUrl: './wallpapers/system/thumbs/15-Sequoia-Light-16x9.avif',
    fullUrl: './wallpapers/system/15-Sequoia-Light-16x9.avif',
  },
  {
    id: 'mac-sonoma-dark',
    name: 'macOS Sonoma Dark',
    category: 'mac',
    thumbnailUrl: './wallpapers/system/thumbs/14-Sonoma-Dark.avif',
    fullUrl: './wallpapers/system/14-Sonoma-Dark.avif',
  },
  {
    id: 'mac-sonoma-light',
    name: 'macOS Sonoma Light',
    category: 'mac',
    thumbnailUrl: './wallpapers/system/thumbs/14-Sonoma-Light.avif',
    fullUrl: './wallpapers/system/14-Sonoma-Light.avif',
  },
  {
    id: 'mac-ventura-dark',
    name: 'macOS Ventura Dark',
    category: 'mac',
    thumbnailUrl: './wallpapers/system/thumbs/13-Ventura-Dark.avif',
    fullUrl: './wallpapers/system/13-Ventura-Dark.avif',
  },
  {
    id: 'mac-ventura-light',
    name: 'macOS Ventura Light',
    category: 'mac',
    thumbnailUrl: './wallpapers/system/thumbs/13-Ventura-Light.avif',
    fullUrl: './wallpapers/system/13-Ventura-Light.avif',
  },
  {
    id: 'mac-tahoe-dark',
    name: 'macOS Tahoe Dark',
    category: 'mac',
    thumbnailUrl: './wallpapers/system/thumbs/16_tahoe_dark.avif',
    fullUrl: './wallpapers/system/16_tahoe_dark.avif',
  },
  {
    id: 'mac-tahoe-light',
    name: 'macOS Tahoe Light',
    category: 'mac',
    thumbnailUrl: './wallpapers/system/thumbs/16_tahoe_light.avif',
    fullUrl: './wallpapers/system/16_tahoe_light.avif',
  },

  // Canvid Base Abstract & Studio Curves
  {
    id: 'canvid-curve-1',
    name: 'Canvid Neon Mesh',
    category: 'canvid',
    thumbnailUrl: './wallpapers/base/thumbs/fruit-basket-4ARHOttyZ8A-unsplash.avif',
    fullUrl: './wallpapers/base/fruit-basket-4ARHOttyZ8A-unsplash.avif',
  },
  {
    id: 'canvid-curve-2',
    name: 'Canvid Velvet Silk',
    category: 'canvid',
    thumbnailUrl: './wallpapers/base/thumbs/fruit-basket-7ANd7X2lCb8-unsplash.avif',
    fullUrl: './wallpapers/base/fruit-basket-7ANd7X2lCb8-unsplash.avif',
  },
  {
    id: 'canvid-curve-3',
    name: 'Canvid Fluid Blue',
    category: 'canvid',
    thumbnailUrl: './wallpapers/base/thumbs/fruit-basket-8uDropEfy48-unsplash.avif',
    fullUrl: './wallpapers/base/fruit-basket-8uDropEfy48-unsplash.avif',
  },
  {
    id: 'canvid-curve-4',
    name: 'Canvid Dark Nebula',
    category: 'canvid',
    thumbnailUrl: './wallpapers/base/thumbs/martin-martz-1hg6NpO0kIk-unsplash.avif',
    fullUrl: './wallpapers/base/martin-martz-1hg6NpO0kIk-unsplash.avif',
  },
  {
    id: 'canvid-curve-5',
    name: 'Canvid Cosmic Glow',
    category: 'canvid',
    thumbnailUrl: './wallpapers/base/thumbs/martin-martz-7it4_acM-0M-unsplash.avif',
    fullUrl: './wallpapers/base/martin-martz-7it4_acM-0M-unsplash.avif',
  },
  {
    id: 'canvid-curve-6',
    name: 'Canvid Amber Wave',
    category: 'canvid',
    thumbnailUrl: './wallpapers/base/thumbs/sean-sinclair-BKhL-edg4Q4-unsplash.avif',
    fullUrl: './wallpapers/base/sean-sinclair-BKhL-edg4Q4-unsplash.avif',
  },
];
