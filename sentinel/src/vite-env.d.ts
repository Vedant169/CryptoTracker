/// <reference types="vite/client" />

// Allow CSS module imports
declare module '*.css' {
  const content: string;
  export default content;
}
