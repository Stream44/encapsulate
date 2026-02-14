
import chalk from 'chalk';

export function TimingObserver({ startTime }: { startTime: number }) {
    let lastTime = startTime

    return {
        chalk,
        record: (step: string) => {
            const now = Date.now()
            const diff = now - lastTime
            lastTime = now

            const line = `[+${diff}ms]   ${step}`
            console.log(diff > 10 ? chalk.red(line) : line)
        },
        recordMajor: (step: string) => {
            const now = Date.now()
            const diff = now - lastTime
            lastTime = now

            const line = `[+${diff}ms] ${step}`
            console.log(diff > 10 ? chalk.red(line) : chalk.cyan(line))
        }
    }
}
