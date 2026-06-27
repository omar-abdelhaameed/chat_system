/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        spotify: [
          "SpotifyMixUI",
          "CircularSp-Arab",
          "CircularSp-Hebr",
          "CircularSp-Cyrl",
          "CircularSp-Grek",
          "CircularSp-Deva",
          "Helvetica Neue",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
      },
      colors: {
        ink: "#121212",
        panel: "#181818",
        panel2: "#1f1f1f",
        tile: "#252525",
        line: "#4d4d4d",
        muted: "#b3b3b3",
        green: "#1ed760",
        red: "#f3727f",
        orange: "#ffa42b",
        blue: "#539df5",
      },
      boxShadow: {
        heavy: "rgba(0,0,0,0.5) 0px 8px 24px",
        medium: "rgba(0,0,0,0.3) 0px 8px 8px",
        insetline:
          "rgb(18,18,18) 0px 1px 0px, rgb(124,124,124) 0px 0px 0px 1px inset",
      },
    },
  },
  plugins: [],
};
