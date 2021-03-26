import { create } from '../utils'
import { generate } from 'astring'
import { join } from 'path'
import { prelude, parseJs, parseSource } from './.utils'
import { readFileSync, writeFileSync } from 'fs'
import { transpile } from '../interpret'

class TestCase {
  program: string
  targets: { [name: string]: string }
}

let VERBOSE = false
let DUMP = false

devTest('make_sound_id', 'duration', VERBOSE, DUMP)
devTest('make_sound_id', 'wave', VERBOSE, DUMP)

devTest('make_sound_sq', 'duration', VERBOSE, DUMP)
devTest('make_sound_sq', 'wave', VERBOSE, DUMP)

devTest('silence_sound', 'duration', VERBOSE, DUMP)
devTest('silence_sound', 'wave', VERBOSE, DUMP)

devTest('noise_sound', 'duration', VERBOSE, DUMP)
devTest('noise_sound', 'wave', VERBOSE, DUMP)

devTest('sine_sound', 'duration', VERBOSE, DUMP)
devTest('sine_sound', 'wave', VERBOSE, DUMP)

devTest('square_sound', 'duration', VERBOSE, DUMP)
devTest('square_sound', 'wave', VERBOSE, DUMP)

devTest('triangle_sound', 'duration', VERBOSE, DUMP)
devTest('triangle_sound', 'wave', VERBOSE, DUMP)

devTest('sawtooth_sound', 'duration', VERBOSE, DUMP)
devTest('sawtooth_sound', 'wave', VERBOSE, DUMP)

devTest('linear_decay', 'func', VERBOSE, DUMP)

devTest('adsr_silence', 'duration', VERBOSE, DUMP)
devTest('adsr_silence', 'wave', VERBOSE, DUMP)

devTest('adsr_noise', 'duration', VERBOSE, DUMP)
devTest('adsr_noise', 'wave', VERBOSE, DUMP)

devTest('adsr_sine', 'duration', VERBOSE, DUMP)
devTest('adsr_sine', 'wave', VERBOSE, DUMP)

devTest('adsr_square', 'duration', VERBOSE, DUMP)
devTest('adsr_square', 'wave', VERBOSE, DUMP)

devTest('adsr_triangle', 'duration', VERBOSE, DUMP)
devTest('adsr_triangle', 'wave', VERBOSE, DUMP)

devTest('adsr_sawtooth', 'duration', VERBOSE, DUMP)
devTest('adsr_sawtooth', 'wave', VERBOSE, DUMP)

devTest('consecutively', 'duration', VERBOSE, DUMP)
devTest('consecutively', 'wave', VERBOSE, DUMP)

devTest('simultaneously', 'duration', VERBOSE, DUMP)
devTest('simultaneously', 'wave', VERBOSE, DUMP)

devTest('trombone', 'duration', VERBOSE, DUMP)
devTest('trombone', 'wave', VERBOSE, DUMP)

devTest('piano', 'duration', VERBOSE, DUMP)
devTest('piano', 'wave', VERBOSE, DUMP)

devTest('bell', 'duration', VERBOSE, DUMP)
devTest('bell', 'wave', VERBOSE, DUMP)

devTest('violin', 'duration', VERBOSE, DUMP)
devTest('violin', 'wave', VERBOSE, DUMP)

devTest('cello', 'duration', VERBOSE, DUMP)
devTest('cello', 'wave', VERBOSE, DUMP)

devTest('chords1', 'duration', VERBOSE, DUMP)
devTest('chords1', 'wave', VERBOSE, DUMP)

devTest('chords2', 'duration', VERBOSE, DUMP)
devTest('chords2', 'wave', VERBOSE, DUMP)

devTest('chords3', 'duration', VERBOSE, DUMP)
devTest('chords3', 'wave', VERBOSE, DUMP)

devTest('chords4', 'duration', VERBOSE, DUMP)
devTest('chords4', 'wave', VERBOSE, DUMP)

devTest('chords7', 'duration', VERBOSE, DUMP)
devTest('chords7', 'wave', VERBOSE, DUMP)

devTest('chords8', 'duration', VERBOSE, DUMP)
devTest('chords8', 'wave', VERBOSE, DUMP)

// devTest('rhapsody', 'duration', VERBOSE, DUMP)
// devTest('rhapsody', 'wave', VERBOSE, DUMP)

function expected(name: string): string {
  return readFileSync(join(__dirname, 'expected', name), { encoding: 'utf-8' })
}

const testCases: { [id: string]: TestCase } = {
  make_sound_id: {
    program: [
      'const sound = make_sound((x) => (x), 1);',
      'const wave = get_wave(sound);',
      'const duration = get_duration(sound);'
    ].join('\n'),
    targets: {
      duration: '1',
      wave: `
      function wave(t) {
        return t >= 1 ? 0 : (t);
      }`
    }
  },
  make_sound_sq: {
    program: [
      'const sound = make_sound((x) => (x * x), 1);',
      'const wave = get_wave(sound);',
      'const duration = get_duration(sound);'
    ].join('\n'),
    targets: {
      duration: '1',
      wave: `
      function wave(t) {
        return t >= 1 ? 0 : (t * t);
      }`
    }
  },
  silence_sound: {
    program: [
      'const sound = silence_sound(1);',
      'const wave = get_wave(sound);',
      'const duration = get_duration(sound);'
    ].join('\n'),
    targets: {
      duration: '1',
      wave: `
      function wave(t) {
        return 0;
      }`
    }
  },
  noise_sound: {
    program: [
      'const sound = noise_sound(1);',
      'const wave = get_wave(sound);',
      'const duration = get_duration(sound);'
    ].join('\n'),
    targets: {
      duration: '1',
      wave: `
      function wave(t) {
        return t >= 1 ? 0 : Math.random() * 2 - 1;
      }`
    }
  },
  sine_sound: {
    program: [
      'const sound = sine_sound(500, 1);',
      'const wave = get_wave(sound);',
      'const duration = get_duration(sound);'
    ].join('\n'),
    targets: {
      duration: '1',
      wave: `
      function wave(t) {
        return t >= 1 ? 0 : Math.sin(3141.592653589793 * t);
      }`
    }
  },
  square_sound: {
    program: [
      'const sound = square_sound(500, 1);',
      'const wave = get_wave(sound);',
      'const duration = get_duration(sound);'
    ].join('\n'),
    targets: {
      duration: '1',
      wave: `
      function wave(t) {
        return t >= 1 ? 0 : 1.2732395447351628 * (Math.sin(3141.592653589793 * t) + Math.sin(9424.77796076938 * t) / 3 + Math.sin(15707.963267948966 * t) / 5 + Math.sin(21991.14857512855 * t) / 7 + Math.sin(28274.33388230814 * t) / 9);
      }`
    }
  },
  triangle_sound: {
    program: [
      'const sound = triangle_sound(500, 1);',
      'const wave = get_wave(sound);',
      'const duration = get_duration(sound);'
    ].join('\n'),
    targets: {
      duration: '1',
      wave: `
      function wave(t) {
        return t >= 1 ? 0 : 0.8105694691387022 * (Math.sin(t * 3141.592653589793) + -1 * Math.sin(9424.77796076938 * t) / 9 + Math.sin(15707.963267948966 * t) / 25 + -1 * Math.sin(21991.14857512855 * t) / 49 + Math.sin(28274.33388230814 * t) / 81);
      }`
    }
  },
  sawtooth_sound: {
    program: [
      'const sound = sawtooth_sound(500, 1);',
      'const wave = get_wave(sound);',
      'const duration = get_duration(sound);'
    ].join('\n'),
    targets: {
      duration: '1',
      wave: `
      function wave(t) {
        return t >= 1 ? 0 : 0.5 - 0.3183098861837907 * (Math.sin(3141.592653589793 * t) + Math.sin(6283.185307179586 * t) / 2 + Math.sin(9424.77796076938 * t) / 3 + Math.sin(12566.370614359172 * t) / 4 + Math.sin(15707.963267948966 * t) / 5);
      }`
    }
  },
  linear_decay: {
    program: 'const func = linear_decay(3);',
    targets: {
      func: `
      function func(t) {
        return t > 3 ? 0 : 1 - t / 3;
      }`
    }
  },
  adsr_silence: {
    program: [
      'const sound = adsr(0.3236, 0.6, 0, 0.1)(silence_sound(1));',
      'const wave = get_wave(sound);',
      'const duration = get_duration(sound);'
    ].join('\n'),
    targets: {
      duration: '1',
      wave: `
      function wave(t) {
        return 0;
      }`
    }
  },
  adsr_noise: {
    program: [
      'const sound = adsr(0.3236, 0.6, 0, 0.1)(noise_sound(1));',
      'const wave = get_wave(sound);',
      'const duration = get_duration(sound);'
    ].join('\n'),
    targets: {
      duration: '1',
      wave: expected('adsr_noise.js')
    }
  },
  adsr_sine: {
    program: [
      'const sound = adsr(0.3236, 0.6, 0, 0.1)(sine_sound(500, 1));',
      'const wave = get_wave(sound);',
      'const duration = get_duration(sound);'
    ].join('\n'),
    targets: {
      duration: '1',
      wave: expected('adsr_sine.js')
    }
  },
  adsr_square: {
    program: [
      'const sound = adsr(0.3236, 0.6, 0, 0.1)(square_sound(500, 1));',
      'const wave = get_wave(sound);',
      'const duration = get_duration(sound);'
    ].join('\n'),
    targets: {
      duration: '1',
      wave: expected('adsr_square.js')
    }
  },
  adsr_triangle: {
    program: [
      'const sound = adsr(0.3236, 0.6, 0, 0.1)(triangle_sound(500, 1));',
      'const wave = get_wave(sound);',
      'const duration = get_duration(sound);'
    ].join('\n'),
    targets: {
      duration: '1',
      wave: expected('adsr_triangle.js')
    }
  },
  adsr_sawtooth: {
    program: [
      'const sound = adsr(0.3236, 0.6, 0, 0.1)(sawtooth_sound(500, 1));',
      'const wave = get_wave(sound);',
      'const duration = get_duration(sound);'
    ].join('\n'),
    targets: {
      duration: '1',
      wave: expected('adsr_sawtooth.js')
    }
  },
  consecutively: {
    program: [
      'const sound = consecutively(list(sawtooth_sound(500, 0.8), sine_sound(1000, 0.2)));',
      'const wave = get_wave(sound);',
      'const duration = get_duration(sound);'
    ].join('\n'),
    targets: {
      duration: '1',
      wave: `
      function wave(t) {
        return t < 0.8 ? t >= 0.8 ? 0 : 0.5 - 0.3183098861837907 * (Math.sin(3141.592653589793 * t) + Math.sin(6283.185307179586 * t) / 2 + Math.sin(9424.77796076938 * t) / 3 + Math.sin(12566.370614359172 * t) / 4 + Math.sin(15707.963267948966 * t) / 5) : t < 1 ? t >= 1 ? 0 : Math.sin(6283.185307179586 * (t - 0.8)) : 0;
      }`
    }
  },
  simultaneously: {
    program: [
      'const sound = simultaneously(list(sawtooth_sound(500, 1), sine_sound(1000, 0.2)));',
      'const wave = get_wave(sound);',
      'const duration = get_duration(sound);'
    ].join('\n'),
    targets: {
      duration: '1',
      wave: `
      function wave(t) {
        return ((t >= 1 ? 0 : 0.5 - 0.3183098861837907 * (Math.sin(3141.592653589793 * t) + Math.sin(6283.185307179586 * t) / 2 + Math.sin(9424.77796076938 * t) / 3 + Math.sin(12566.370614359172 * t) / 4 + Math.sin(15707.963267948966 * t) / 5)) + (t >= 0.2 ? 0 : Math.sin(6283.185307179586 * t))) / 2;
      }`
    }
  },
  trombone: {
    program: [
      'const sound = trombone(46, 1);',
      'const wave = get_wave(sound);',
      'const duration = get_duration(sound);'
    ].join('\n'),
    targets: {
      duration: '1',
      wave: expected('trombone.js')
    }
  },
  piano: {
    program: [
      'const sound = piano(46, 1);',
      'const wave = get_wave(sound);',
      'const duration = get_duration(sound);'
    ].join('\n'),
    targets: {
      duration: '1',
      wave: expected('piano.js')
    }
  },
  bell: {
    program: [
      'const sound = bell(46, 1);',
      'const wave = get_wave(sound);',
      'const duration = get_duration(sound);'
    ].join('\n'),
    targets: {
      duration: '1',
      wave: expected('bell.js')
    }
  },
  violin: {
    program: [
      'const sound = violin(46, 1);',
      'const wave = get_wave(sound);',
      'const duration = get_duration(sound);'
    ].join('\n'),
    targets: {
      duration: '1',
      wave: expected('violin.js')
    }
  },
  cello: {
    program: [
      'const sound = cello(46, 1);',
      'const wave = get_wave(sound);',
      'const duration = get_duration(sound);'
    ].join('\n'),
    targets: {
      duration: '1',
      wave: expected('cello.js')
    }
  },
  chords1: {
    program: [
      'const sound = chords1();',
      'const wave = get_wave(sound);',
      'const duration = get_duration(sound);'
    ].join('\n'),
    targets: {
      duration: '4',
      wave: expected('chords1.js')
    }
  },
  chords2: {
    program: [
      'const sound = chords2();',
      'const wave = get_wave(sound);',
      'const duration = get_duration(sound);'
    ].join('\n'),
    targets: {
      duration: '4',
      wave: expected('chords2.js')
    }
  },
  chords3: {
    program: [
      'const sound = chords3();',
      'const wave = get_wave(sound);',
      'const duration = get_duration(sound);'
    ].join('\n'),
    targets: {
      duration: '4',
      wave: expected('chords3.js')
    }
  },
  chords4: {
    program: [
      'const sound = chords4();',
      'const wave = get_wave(sound);',
      'const duration = get_duration(sound);'
    ].join('\n'),
    targets: {
      duration: '4',
      wave: expected('chords4.js')
    }
  },
  chords7: {
    program: [
      'const sound = chords7();',
      'const wave = get_wave(sound);',
      'const duration = get_duration(sound);'
    ].join('\n'),
    targets: {
      duration: '4',
      wave: expected('chords7.js')
    }
  },
  chords8: {
    program: [
      'const sound = chords8();',
      'const wave = get_wave(sound);',
      'const duration = get_duration(sound);'
    ].join('\n'),
    targets: {
      duration: '4',
      wave: expected('chords8.js')
    }
  },
  rhapsody: {
    program: [
      'const sound = rhapsody();',
      'const wave = get_wave(sound);',
      'const duration = get_duration(sound);'
    ].join('\n'),
    targets: {
      duration: '40',
      wave: `
      `
    }
  }
}

function devTest(id: string, target: string, verbose: boolean = false, dump: boolean = false) {
  test(`${id}:${target}`, () => {
    const { program, targets } = testCases[id]

    const ast = transpile(target, ...parseSource(prelude + program))
    const result = ast.type === 'Literal' ? create.expressionStatement(ast) : ast

    const expected = generate(parseJs(targets[target])).trim()
    const received = generate(result).trim()
    if (verbose) {
      console.log(received)
    }

    if (dump) {
      writeFileSync(`${id}.${target}.js`, received + '\n')
    }

    expect(received).toEqual(expected)
  })
}
