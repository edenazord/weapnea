/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_BACKEND_MODE?: 'api';
	readonly VITE_API_BASE_URL?: string;
	readonly VITE_API_TOKEN?: string;
	readonly VITE_GOOGLE_MAPS_API_KEY?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
