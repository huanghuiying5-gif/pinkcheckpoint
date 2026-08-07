import { RouterProvider } from "react-router-dom";

import { ApplicationServicesProvider } from "./ApplicationServicesProvider";
import { appRouter } from "./router";

export function App() {
  return (
    <ApplicationServicesProvider>
      <RouterProvider router={appRouter} />
    </ApplicationServicesProvider>
  );
}
