// Entry bundle buat harness uji engine — memastikan store & engine
// berbagi SATU instance modul yang sama.
export * from '../../src/lib/diagnostics/store';
export { buildVerdict } from '../../src/lib/diagnostics/engine';
