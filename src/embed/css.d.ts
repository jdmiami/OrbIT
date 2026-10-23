/** The build (scripts/build.mjs) loads .css files as text for the shadow root. */
declare module '*.css' {
  const text: string;
  export default text;
}
