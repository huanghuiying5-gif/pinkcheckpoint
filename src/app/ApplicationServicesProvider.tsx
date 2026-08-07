import { createContext, useContext } from "react";
import type { PropsWithChildren } from "react";

import { TeacherSetupApi } from "../services/auth";
import { SpeechAnalysisApiClient } from "../services/analysis";
import { ApiReadingPassageRepository } from "../services/persistence";
import { createApplicationServices } from "./services";
import type { ApplicationServices } from "./services";

const defaultServices = createApplicationServices({
  readingPassageRepository: new ApiReadingPassageRepository(),
  teacherSetupApi: new TeacherSetupApi(),
  speechAnalysisApi: new SpeechAnalysisApiClient(),
});

const ApplicationServicesContext = createContext<ApplicationServices | null>(
  null,
);

export function ApplicationServicesProvider({
  children,
}: PropsWithChildren) {
  return (
    <ApplicationServicesContext.Provider value={defaultServices}>
      {children}
    </ApplicationServicesContext.Provider>
  );
}

export function useApplicationServices(): ApplicationServices {
  const services = useContext(ApplicationServicesContext);
  if (!services) {
    throw new Error(
      "useApplicationServices must be used inside ApplicationServicesProvider.",
    );
  }
  return services;
}
