import type { TeacherSetupApi } from "../services/auth";
import type { SpeechAnalysisApiClient } from "../services/analysis";
import type { ReadingPassageRepository } from "../services/persistence";
import { ReadingPassageService } from "../services/persistence";

export interface ApplicationServices {
  readingPassages: ReadingPassageService;
  teacherSetup: TeacherSetupApi;
  speechAnalysis: SpeechAnalysisApiClient;
}

export interface ApplicationServiceDependencies {
  readingPassageRepository: ReadingPassageRepository;
  teacherSetupApi: TeacherSetupApi;
  speechAnalysisApi: SpeechAnalysisApiClient;
}

export function createApplicationServices(
  dependencies: ApplicationServiceDependencies,
): ApplicationServices {
  return Object.freeze({
    readingPassages: new ReadingPassageService(
      dependencies.readingPassageRepository,
    ),
    teacherSetup: dependencies.teacherSetupApi,
    speechAnalysis: dependencies.speechAnalysisApi,
  });
}
