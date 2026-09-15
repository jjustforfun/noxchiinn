import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { Boundary } from "./Boundary";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Boundary><App /></Boundary>
  </StrictMode>
);
