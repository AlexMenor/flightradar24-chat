export {};

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      PORT: string;
      COOKIE_SECRET: string;
    }
  }
}
