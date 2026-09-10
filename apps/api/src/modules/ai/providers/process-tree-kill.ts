import { execFile } from 'node:child_process';

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
