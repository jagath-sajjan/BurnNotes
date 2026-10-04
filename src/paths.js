import { fileURLToPath } from 'node:url'

export const ROOT_DIR = fileURLToPath(new URL('../', import.meta.url))
export const PUBLIC_DIR = fileURLToPath(new URL('../public/', import.meta.url))
