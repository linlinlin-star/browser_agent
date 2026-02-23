export * from './logger';

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function parseActionString(actionStr: string): { action_type: string; action_inputs: Record<string, any> } | null {
  const match = actionStr.match(/^(\w+)\((.*)\)$/);
  if (!match) return null;

  const action_type = match[1];
  const argsStr = match[2];

  if (!argsStr || argsStr.trim() === '') {
    return { action_type, action_inputs: {} };
  }

  const action_inputs: Record<string, any> = {};
  const argRegex = /(\w+)\s*=\s*['"]([^'"]*)['"]/g;
  let argMatch;

  while ((argMatch = argRegex.exec(argsStr)) !== null) {
    action_inputs[argMatch[1]] = argMatch[2];
  }

  const pointRegex = /(\w+)\s*=\s*<point>(\d+)\s+(\d+)<\/point>/g;
  while ((argMatch = pointRegex.exec(argsStr)) !== null) {
    action_inputs[argMatch[1]] = {
      x: parseInt(argMatch[2], 10),
      y: parseInt(argMatch[3], 10),
    };
  }

  return { action_type, action_inputs };
}

export function normalizeCoordinates(
  coords: { x: number; y: number },
  screenWidth: number,
  screenHeight: number,
  scaleFactor: number = 1000
): { x: number; y: number } {
  return {
    x: Math.round((coords.x / scaleFactor) * screenWidth),
    y: Math.round((coords.y / scaleFactor) * screenHeight),
  };
}
