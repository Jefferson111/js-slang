import { Context, createContext, parseError } from '../../index'
import { parse } from '../../parser/parser'
import { parse as parseOrig } from 'acorn'
import { strict as assert } from 'assert'
import * as es from 'estree'

export function parseJs(program: string): acorn.Node {
  return parseOrig(program, { ecmaVersion: 2020 }) as acorn.Node
}

export function parseSource(program: string): [es.Program, Context] {
  const context = createContext(4, 'default', undefined, undefined)
  const ast = parse(program, context)
  assert(context.errors.length === 0, parseError(context.errors))
  return [ast as es.Program, context]
}

export const prelude = [
  `
  function pair(x, xs) {
    return [x, xs];
  }
  `,
  `
  function head(xs) {
    return xs[0];
  }
  `,
  `
  function tail(xs) {
    return xs[1];
  }
  `,
  `
  function is_null(xs) {
    return xs === null;
  }
  `,
  `
  function accumulate(op, initial, sequence) {
    if (is_null(sequence)) {
      return initial;
    } else {
      return op(head(sequence), accumulate(op, initial, tail(sequence)));
    }
  }
  `,
  `
  function get_wave(sound) {
    return head(sound);
  }
  `,
  `
  function get_duration(sound) {
    return tail(sound);
  }
  `,
  `
  function make_sound(wave, duration) {
    return pair(t => t >= duration ? 0 : wave(t), duration);
  }
  `,
  `
  function silence_sound(duration) {
    return make_sound(t => 0, duration);
  }
  `,
  `
  function noise_sound(duration) {
    return make_sound(t => math_random() * 2 - 1, duration);
  }
  `,
  `
  function sine_sound(freq, duration) {
    return make_sound(t => math_sin(2 * math_PI * t * freq), duration);
  }
  `,
  `const fourier_expansion_level = 5;`,
  `
  function square_sound(freq, duration) {
    function fourier_expansion_square(t) {
      let answer = 0;
      for (let i = 1; i <= fourier_expansion_level; i = i + 1) {
        answer = answer + math_sin(2 * math_PI * (2 * i - 1) * freq * t) / (2 * i - 1);
      }
      return answer;
    }
    return make_sound(t => (4 / math_PI) * fourier_expansion_square(t), duration);
  }
  `,
  `
  function triangle_sound(freq, duration) {
    function fourier_expansion_triangle(t) {
        let answer = 0;
        for (let i = 0; i < fourier_expansion_level; i = i + 1) {
            answer = answer + math_pow(-1, i) * math_sin((2 * i + 1) * t * freq * math_PI * 2) / math_pow((2 * i + 1), 2);
        }
        return answer;
    }
    return make_sound(t =>
        (8 / math_PI / math_PI) * fourier_expansion_triangle(t),
        duration);
  }
  `,
  `
  function sawtooth_sound(freq, duration) {
    function fourier_expansion_sawtooth(t) {
        let answer = 0;
        for (let i = 1; i <= fourier_expansion_level; i = i + 1) {
            answer = answer + math_sin(2 * math_PI * i * freq * t) / i;
        }
        return answer;
    }
    return make_sound(t =>
		      (1 / 2) - (1 / math_PI) * fourier_expansion_sawtooth(t),
		      duration);
  }
  `,
  `
  function linear_decay(decay_period) {
    return t => {
        if ((t > decay_period) || (t < 0)) {
            return 0;
        } else {
            return 1 - (t / decay_period);
        }
    };
  }
  `,
  `
  function adsr(attack_ratio, decay_ratio, sustain_level, release_ratio) {
    return sound => {
        const wave = get_wave(sound);
        const duration = get_duration(sound);
        const attack_time = duration * attack_ratio;
        const decay_time = duration * decay_ratio;
        const release_time = duration * release_ratio;
        return make_sound( x => {
            if (x < attack_time) {
                return wave(x) * (x / attack_time);
            } else if (x < attack_time + decay_time) {
                return ((1 - sustain_level) *
                        (linear_decay(decay_time))(x - attack_time) + sustain_level) *
                         wave(x);
            } else if (x < duration - release_time) {
                return wave(x) * sustain_level;
            } else if (x <= duration) {
                return wave(x) * sustain_level *
                        (linear_decay(release_time))(x - (duration - release_time));
            } else {
                return 0;
            }
        }, duration);
    };
  }
  `,
  `
  function consecutively(list_of_sounds) {
    function consec_two(ss1, ss2) {
        const wave1 = head(ss1);
        const wave2 = head(ss2);
        const dur1 = tail(ss1);
        const dur2 = tail(ss2);
        const new_wave = t => t < dur1 ? wave1(t) : wave2(t - dur1);
        return pair(new_wave, dur1 + dur2);
    }
    return accumulate(consec_two, silence_sound(0), list_of_sounds);
  }
  `,
  `
  function simultaneously(list_of_sounds) {
    function musher(ss1, ss2) {
        const wave1 = head(ss1);
        const wave2 = head(ss2);
        const dur1 = tail(ss1);
        const dur2 = tail(ss2);
        // new_wave assumes sound discipline (ie, wave(t) = 0 after t > dur)
        const new_wave = t => wave1(t) + wave2(t);
        // new_dur is higher of the two dur
        const new_dur = dur1 < dur2 ? dur2 : dur1;
        return pair(new_wave, new_dur);
    }

    const mushed_sounds = accumulate(musher, silence_sound(0), list_of_sounds);
    const normalised_wave = t => (head(mushed_sounds))(t) / length(list_of_sounds);
    const highest_duration = tail(mushed_sounds);
    return pair(normalised_wave, highest_duration);
  }
  `,
  `
  function midi_note_to_frequency(note) {
    // A4 = 440Hz = midi note 69
    return 440 * math_pow(2, (note - 69) / 12);
  }
  `,
  `
  function stacking_adsr(waveform, base_frequency, duration, envelopes) {
    function zip(lst, n) {
      if (is_null(lst)) {
        return lst;
      } else {
        return pair(pair(n, head(lst)), zip(tail(lst), n + 1));
      }
    }

    return simultaneously(
      accumulate(
        (x, y) => pair(tail(x)(waveform(base_frequency * head(x), duration)), y),
        null,
        zip(envelopes, 1)
      )
    );
  }
  `,
  `
  function trombone(note, duration) {
    return stacking_adsr(
      square_sound,
      midi_note_to_frequency(note),
      duration,
      list(adsr(0.2, 0, 1, 0.1), adsr(0.3236, 0.6, 0, 0.1))
    );
  }
  `,
  `
  function piano(note, duration) {
    return stacking_adsr(
      triangle_sound,
      midi_note_to_frequency(note),
      duration,
      list(adsr(0, 0.515, 0, 0.05), adsr(0, 0.32, 0, 0.05), adsr(0, 0.2, 0, 0.05))
    );
  }
  `,
  `
  function bell(note, duration) {
    return stacking_adsr(
      square_sound,
      midi_note_to_frequency(note),
      duration,
      list(
        adsr(0, 0.6, 0, 0.05),
        adsr(0, 0.6618, 0, 0.05),
        adsr(0, 0.7618, 0, 0.05),
        adsr(0, 0.9071, 0, 0.05)
      )
    );
  }
  `,
  `
  function violin(note, duration) {
    return stacking_adsr(
      sawtooth_sound,
      midi_note_to_frequency(note),
      duration,
      list(
        adsr(0.35, 0, 1, 0.15),
        adsr(0.35, 0, 1, 0.15),
        adsr(0.45, 0, 1, 0.15),
        adsr(0.45, 0, 1, 0.15)
      )
    );
  }
  `,
  `
  function cello(note, duration) {
    return stacking_adsr(
      square_sound,
      midi_note_to_frequency(note),
      duration,
      list(adsr(0.05, 0, 1, 0.1), adsr(0.05, 0, 1, 0.15), adsr(0, 0, 0.2, 0.15))
    );
  }
  `,
  `
  function chords1() {
    const c = consecutively;
    const s = simultaneously;

    const zero = silence_sound;
    const s1 = bell;
    const s2 = cello;
    const s3 = bell;
    const s4 = trombone;

    const snd = c(
      list(
        s(list(s1(58, 0.5), s1(62, 0.5))),
        s1(53, 0.5),
        s1(58, 0.5),
        s1(62, 0.5),
        s(list(s1(79, 1), c(list(s1(67, 0.5), s1(53, 0.5))))),
        s(list(s1(77, 1), c(list(s1(65, 0.5), s1(53, 0.5)))))
      )
    );

    return snd;
  }
  `,
  `
  function chords2() {
    const c = consecutively;
    const s = simultaneously;

    const zero = silence_sound;
    const s1 = bell;
    const s2 = cello;
    const s3 = bell;
    const s4 = trombone;

    return c(
      list(
        s(list(s1(58, 0.5), s1(62, 0.5))),
        s1(55, 0.5),
        s1(58, 0.5),
        s1(62, 0.5),
        s(list(s1(81, 1), c(list(s1(69, 0.5), s1(55, 0.5))))),
        s(list(s1(79, 1), c(list(s1(67, 0.5), s1(55, 0.5)))))
      )
    );
  }
  `,
  `
  function chords3() {
    return consecutively(
      list(
        simultaneously(list(bell(60, 0.5), bell(63, 0.5))),
        bell(60, 0.5),
        bell(63, 0.5),
        bell(67, 0.5),
        simultaneously(
          list(bell(86, 1), consecutively(list(bell(74, 0.5), bell(60, 0.5))))
        ),
        simultaneously(
          list(bell(84, 1), consecutively(list(bell(72, 0.5), bell(60, 0.5))))
        )
      )
    );
  }
  `,
  `
  function chords4() {
    return consecutively(
      list(
        simultaneously(list(bell(63, 0.5), bell(67, 0.5))),
        bell(60, 0.5),
        bell(63, 0.5),
        bell(67, 0.5),
        simultaneously(list(bell(60, 0.5), bell(63, 0.5), bell(69, 0.5))),
        bell(63, 0.5),
        bell(65, 0.5),
        bell(72, 0.5)
      )
    );
  }
  `,
  `
  function chords7() {
    return consecutively(
      list(
        simultaneously(list(bell(63, 0.5), bell(67, 0.5))),
        bell(60, 0.5),
        bell(63, 0.5),
        bell(67, 0.5),
        simultaneously(list(bell(59, 0.5), bell(63, 0.5))),
        bell(67, 0.5),
        simultaneously(list(bell(58, 0.5), bell(63, 0.5))),
        bell(67, 0.5)
      )
    );
  }
  `,
  `
  function chords8() {
    return consecutively(
      list(
        simultaneously(list(bell(57, 0.5), bell(63, 0.5))),
        bell(57, 0.5),
        bell(63, 0.5),
        bell(67, 0.5),
        simultaneously(list(bell(56, 0.5), bell(63, 0.5))),
        bell(67, 0.5),
        simultaneously(list(bell(55, 0.5), bell(63, 0.5))),
        bell(67, 0.5)
      )
    );
  }
  `,
  `
  function rhapsody() {
    const c = consecutively;
    const s = simultaneously;

    const zero = silence_sound;
    const s1 = bell;
    const s2 = cello;
    const s3 = bell;
    const s4 = trombone;

    function helper(freq, dur) {
      return s(
        list(
          s3(freq, dur / 2),
          s3(freq - 12, dur / 2),
          s4(freq, dur),
          s4(freq - 12, dur)
        )
      );
    }

    const chords1 = c(
      list(
        s(list(s1(58, 0.5), s1(62, 0.5))),
        s1(53, 0.5),
        s1(58, 0.5),
        s1(62, 0.5),
        s(list(s1(79, 1), c(list(s1(67, 0.5), s1(53, 0.5))))),
        s(list(s1(77, 1), c(list(s1(65, 0.5), s1(53, 0.5)))))
      )
    );

    const chords2 = c(
      list(
        s(list(s1(58, 0.5), s1(62, 0.5))),
        s1(55, 0.5),
        s1(58, 0.5),
        s1(62, 0.5),
        s(list(s1(81, 1), c(list(s1(69, 0.5), s1(55, 0.5))))),
        s(list(s1(79, 1), c(list(s1(67, 0.5), s1(55, 0.5)))))
      )
    );

    const chords3 = c(
      list(
        s(list(s1(60, 0.5), s1(63, 0.5))),
        s1(60, 0.5),
        s1(63, 0.5),
        s1(67, 0.5),
        s(list(s1(86, 1), c(list(s1(74, 0.5), s1(60, 0.5))))),
        s(list(s1(84, 1), c(list(s1(72, 0.5), s1(60, 0.5)))))
      )
    );

    const chords4 = c(
      list(
        s(list(s1(63, 0.5), s1(67, 0.5))),
        s1(60, 0.5),
        s1(63, 0.5),
        s1(67, 0.5),
        s(list(s1(60, 0.5), s1(63, 0.5), s1(69, 0.5))),
        s1(63, 0.5),
        s1(65, 0.5),
        s1(72, 0.5)
      )
    );

    const chords5 = chords1;

    const chords6 = chords2;

    const chords7 = c(
      list(
        s(list(s1(63, 0.5), s1(67, 0.5))),
        s1(60, 0.5),
        s1(63, 0.5),
        s1(67, 0.5),
        s(list(s1(59, 0.5), s1(63, 0.5))),
        s1(67, 0.5),
        s(list(s1(58, 0.5), s1(63, 0.5))),
        s1(67, 0.5)
      )
    );

    const chords8 = c(
      list(
        s(list(s1(57, 0.5), s1(63, 0.5))),
        s1(57, 0.5),
        s1(63, 0.5),
        s1(67, 0.5),
        s(list(s1(56, 0.5), s1(63, 0.5))),
        s1(67, 0.5),
        s(list(s1(55, 0.5), s1(63, 0.5))),
        s1(67, 0.5)
      )
    );

    const vocals1 = c(
      list(
        zero(8),
        s2(62, 0.33),
        s2(62, 2.92),
        zero(0.25),
        s2(58, 0.5),
        s2(60, 0.5),
        s2(62, 0.25),
        s2(62, 2.25),
        zero(0.5),
        s2(62, 0.25),
        s2(62, 0.25),
        s2(63, 0.33),
        s2(65, 0.33),
        s2(63, 0.59),
        s2(62, 0.5),
        s2(60, 0.75),
        zero(0.5),
        s2(60, 0.5),
        s2(62, 0.5),
        s2(63, 0.25),
        s2(65, 0.5),
        s2(63, 0.5),
        s2(62, 0.5),
        s2(60, 1.25),
        zero(1)
      )
    );

    const vocals2 = c(
      list(
        s2(62, 0.33),
        s2(62, 2.42),
        zero(0.25),
        s2(62, 0.5),
        s2(65, 0.5),
        s2(69, 0.75),
        s2(67, 0.25),
        s2(67, 2),
        zero(0.5),
        s2(67, 0.5),
        s2(70, 0.5),
        s2(70, 0.5),
        s2(70, 0.5),
        s2(70, 0.5),
        s2(70, 0.75),
        s2(67, 0.25),
        s2(63, 0.67),
        s2(62, 0.33),
        s2(60, 3),
        zero(1)
      )
    );

    const BASS = c(
      list(
        helper(46, 4),
        helper(46, 4),
        helper(46, 4),
        helper(43, 4),
        helper(48, 4),
        helper(48, 2),
        helper(53, 2),
        helper(46, 4),
        helper(43, 4),
        helper(48, 2),
        helper(47, 1),
        helper(46, 1),
        helper(45, 2),
        helper(44, 1),
        helper(43, 1)
      )
    );

    const CHORDS = c(
      list(
        chords1,
        chords1,
        chords1,
        chords2,
        chords3,
        chords4,
        chords5,
        chords6,
        chords7,
        chords8
      )
    );

    const VOCALS = c(list(vocals1, vocals2));

    return s(list(VOCALS, BASS, CHORDS));
  }
  `
].join('\n')
