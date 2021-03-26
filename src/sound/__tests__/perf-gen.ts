import { generate } from 'astring'
import { prelude, parseSource } from './.utils'
import { transpile } from '../interpret'
import { writeFileSync } from 'fs'
import { join } from 'path'

const dir = 'performance/static/tests'

// const sounds = ['trombone', 'piano', 'bell', 'violin', 'cello']

// for (const s of sounds) {
//   for (let d = 1; d <= 64; d++) {
//     const program = [
//       `const sound = ${s}(46, ${d});`,
//       'const wave = get_wave(sound);',
//       'const duration = get_duration(sound);'
//     ].join('\n')

//     const testname = `${s}.46.${d.toString().padStart(3, '0')}`

//     dump(program, testname)
//   }
// }

const sounds = ['chords1', 'chords2', 'chords3', 'chords4', 'chords7', 'chords8']

for (const s of sounds) {
  const program = [
    `const sound = ${s}();`,
    'const wave = get_wave(sound);',
    'const duration = get_duration(sound);'
  ].join('\n')

  dump(program, s)
}

function dump(program: string, testname: string) {
  test(testname, () => {
    const wave = generate(transpile('wave', ...parseSource(prelude + program)))

    const write_out = [
      program.replace('const wave =', 'const wave_cpu ='),
      wave.replace('function wave', 'function wave_gpu')
    ]

    writeFileSync(join(dir, testname + '.js'), write_out.join('\n\n') + '\n')

    expect(true)
  })
}
