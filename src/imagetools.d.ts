// vite-imagetools : les imports avec query params renvoient une URL (string) grâce au suffixe `&url`.
declare module "*&url" {
  const url: string;
  export default url;
}
declare module "*?format=webp&url" {
  const url: string;
  export default url;
}
declare module "*?format=avif&url" {
  const url: string;
  export default url;
}
