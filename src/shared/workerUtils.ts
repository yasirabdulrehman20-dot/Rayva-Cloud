export function getWorkerDisplayName(workerId?: string | null, currentName?: string | null): string {
  // If explicitly worker ID matches standard set:
  if (workerId === 'worker-01' || workerId === 'worker-1') return 'Rayva Titan';
  if (workerId === 'worker-02' || workerId === 'worker-2') return 'Rayva Vector';
  if (workerId === 'worker-03' || workerId === 'worker-3') return 'Rayva Flux';
  if (workerId === 'worker-04' || workerId === 'worker-4') return 'Rayva Edge';

  if (currentName) {
    if (currentName.includes('Alpha') || currentName.includes('alpha') || currentName.includes('worker-01') || currentName.includes('worker-1')) {
      return 'Rayva Titan';
    }
    if (currentName.includes('Beta') || currentName.includes('beta') || currentName.includes('worker-02') || currentName.includes('worker-2')) {
      return 'Rayva Vector';
    }
    if (currentName.includes('Gamma') || currentName.includes('gamma') || currentName.includes('worker-03') || currentName.includes('worker-3')) {
      return 'Rayva Flux';
    }
    if (currentName.includes('Delta') || currentName.includes('delta') || currentName.includes('worker-04') || currentName.includes('worker-4')) {
      return 'Rayva Edge';
    }
    return currentName;
  }

  if (workerId) {
    if (workerId.includes('worker-01')) return 'Rayva Titan';
    if (workerId.includes('worker-02')) return 'Rayva Vector';
    if (workerId.includes('worker-03')) return 'Rayva Flux';
    if (workerId.includes('worker-04')) return 'Rayva Edge';
    return workerId;
  }

  return 'Unassigned';
}

export function sanitizeWorkerText(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(/Worker-Alpha\s*\(High Performance\)/gi, 'Rayva Titan')
    .replace(/Worker-Beta\s*\(Balanced\)/gi, 'Rayva Vector')
    .replace(/Worker-Gamma\s*\(Compute Optimized\)/gi, 'Rayva Flux')
    .replace(/Worker-Delta\s*\(Standard\)/gi, 'Rayva Edge')
    .replace(/Worker-Alpha/gi, 'Rayva Titan')
    .replace(/Worker-Beta/gi, 'Rayva Vector')
    .replace(/Worker-Gamma/gi, 'Rayva Flux')
    .replace(/Worker-Delta/gi, 'Rayva Edge')
    .replace(/worker-alpha-\d+/gi, 'Rayva Titan')
    .replace(/worker-beta-\d+/gi, 'Rayva Vector')
    .replace(/worker-gamma-\d+/gi, 'Rayva Flux')
    .replace(/worker-delta-\d+/gi, 'Rayva Edge')
    .replace(/worker-01/gi, 'Rayva Titan')
    .replace(/worker-02/gi, 'Rayva Vector')
    .replace(/worker-03/gi, 'Rayva Flux')
    .replace(/worker-04/gi, 'Rayva Edge');
}
