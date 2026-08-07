export type ReadingPassageId = string;
export type IsoDateTime = string;

export interface ReadingPassage {
  id: ReadingPassageId;
  content: string;
  revision: number;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface SaveReadingPassageInput {
  content: string;
}
