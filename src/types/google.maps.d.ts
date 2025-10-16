// Minime dichiarazioni per l'oggetto globale google per evitare errori TS
declare const google: any;

declare global {
  interface Window {
    google: any;
  }
}

export {};
