declare global {
  namespace NodeJS {
    interface ProcessEnv {
      SQLITE_FILE_LOCATION: string;
      PORT: integer;
      JWT_SECRET: string;
    }
  }
}

export {};
