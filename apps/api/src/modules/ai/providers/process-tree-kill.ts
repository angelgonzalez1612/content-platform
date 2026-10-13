import { execFile, execFileSync } from 'node:child_process';

// child.kill() en Windows solo termina el proceso apuntado por el pid — si
// ese proceso es en realidad un wrapper que lanzó hijos propios (el CLI de
// Claude, o Codex vía `spawn(..., {shell:true})` que primero levanta
// cmd.exe), los hijos quedan huérfanos y vivos. Visto en vivo: un `timeout`
// de 60s en execFile no impidió que un proceso de automatización siguiera
// corriendo 15+ minutos después. taskkill /T mata el árbol completo; en
// POSIX no hace falta este rodeo (kill() ya se propaga al hijo directo).
export function killProcessTree(pid: number): void {
  if (process.platform === 'win32') {
    execFile('taskkill', ['/pid', String(pid), '/t', '/f'], () => {
      // Silencioso a propósito: si el proceso ya había terminado por su
      // cuenta, taskkill solo reporta "no se encontró" — no vale la pena
      // propagar ese caso como error.
    });
  } else {
    try {
      process.kill(pid, 'SIGKILL');
    } catch {
      // Ya estaba muerto — nada que hacer.
    }
  }
}

// El timeout cubre las llamadas lentas, pero no el caso de que la API misma se
// apague (Ctrl+C, reinicio del watch, crash) con un `claude`/`codex` en pleno
// vuelo: nadie lo mataba y quedaba como "ventana" huérfana consumiendo cuota.
// Cada hijo se registra mientras vive y, al salir el proceso, se mata el árbol
// de los que sigan abiertos.
//
// El registro vive en globalThis y no en el módulo: bajo HMR (ver main.ts) el
// módulo se reevalúa en el mismo proceso, y los listeners de `process` se
// instalarían de nuevo apuntando a un registro vacío.
const REGISTRY_KEY = Symbol.for('content-platform.cli-child-registry');

interface ChildRegistry {
  pids: Set<number>;
  installed: boolean;
}

function getRegistry(): ChildRegistry {
  const g = globalThis as unknown as Record<symbol, ChildRegistry | undefined>;
  return (g[REGISTRY_KEY] ??= { pids: new Set<number>(), installed: false });
}

function killTrackedSync(): void {
  const { pids } = getRegistry();
  for (const pid of pids) {
    try {
      if (process.platform === 'win32') {
        execFileSync('taskkill', ['/pid', String(pid), '/t', '/f'], { stdio: 'ignore' });
      } else {
        process.kill(pid, 'SIGKILL');
      }
    } catch {
      // Ya había terminado — nada que hacer.
    }
  }
  pids.clear();
}

function installExitHooks(registry: ChildRegistry): void {
  if (registry.installed) return;
  registry.installed = true;
  process.on('exit', killTrackedSync);
  const signals: [NodeJS.Signals, number][] = [['SIGINT', 130], ['SIGTERM', 143], ['SIGBREAK', 149]];
  for (const [signal, code] of signals) {
    process.on(signal, () => {
      killTrackedSync();
      // Con este listener instalado Node ya no termina solo; si nadie más
      // maneja la señal (p.ej. Nest con shutdown hooks), se sale aquí.
      if (process.listenerCount(signal) === 1) process.exit(code);
    });
  }
}

/** Registra el hijo para matarlo si la API se apaga mientras corre. Devuelve la
 * función que lo da de baja (llamarla al terminar, de cualquier forma). */
export function trackChildProcess(pid: number | undefined): () => void {
  if (!pid) return () => undefined;
  const registry = getRegistry();
  installExitHooks(registry);
  registry.pids.add(pid);
  return () => {
    registry.pids.delete(pid);
  };
}
