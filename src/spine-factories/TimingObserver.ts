
import chalk from 'chalk';

export type TimingOptions = { color?: 'red' | 'green' | 'yellow' | 'cyan' | 'gray' }

export type TimingObserverInterface = {
    record: (step: string, opts?: TimingOptions) => void,
    recordMajor: (step: string, opts?: TimingOptions) => void,
    chalk: typeof chalk,
}

export function TimingObserver(): TimingObserverInterface {
    let lastTime = performance.now()

    function format(msg: string, diff: string, opts?: TimingOptions): string {
        const line = `[+${diff}ms] ${msg}`
        if (opts?.color) return (chalk as any)[opts.color](line)
        return line
    }

    return {
        chalk,
        record: (step: string, opts?: TimingOptions) => {
            const now = performance.now()
            const diff = (now - lastTime).toFixed(1)
            lastTime = now
            console.log(format(`  ${step}`, diff, opts))
        },
        recordMajor: (step: string, opts?: TimingOptions) => {
            const now = performance.now()
            const diff = (now - lastTime).toFixed(1)
            lastTime = now
            console.log(format(`★ ${step}`, diff, opts))
        }
    }
}
