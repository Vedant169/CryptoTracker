/// <reference types="vite/client" />

// Allow CSS module imports
declare module '*.css' {
  const content: string;
  export default content;
}

// NeoVis.js is loaded via CDN script tag in index.html
interface Window {
  NeoVis: any;
}
