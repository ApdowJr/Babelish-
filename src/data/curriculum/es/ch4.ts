import { choose, typeEx, listen, speak } from '@/data/curriculum/helpers';
import type { ChapterSource } from '@/lib/curriculum/types';

export const ch4: ChapterSource = {
  cefr: 'A1',
  title: 'Mi rutina diaria',
  description: 'Describe your day, your schedule, and your habits.',
  lessons: [
    {
      title: 'Por la mañana',
      goal: 'Talk about the start of your day',
      exercises: [
        choose('Me levanto a las siete.', ['I get up at seven.', 'I go to bed at seven.', 'I work at seven.', 'I eat at seven.'], 'I get up at seven.', {
          note: 'Reflexive: me levanto (I get myself up), me acuesto (I lie down).',
          vocab: { target: 'me levanto', translation: 'I get up' },
        }),
        typeEx('Translate into Spanish', 'I wake up', ['me despierto', 'despierto'], {
          vocab: { target: 'me despierto', translation: 'I wake up' },
        }),
        choose('desayuno', ['Lunch', 'Breakfast', 'Dinner', 'Snack'], 'Breakfast', {
          vocab: { target: 'desayuno', translation: 'breakfast' },
        }),
        listen('Me ducho por la mañana', ['me ducho por la mañana', 'me ducho por la noche', 'desayuno por la mañana', 'me levanto por la tarde']),
        typeEx('Translate into Spanish', 'I take a shower', ['me ducho', 'ducho'], {
          note: 'Ducharse = to shower (from “ducha”, the shower).',
          vocab: { target: 'me ducho', translation: 'I take a shower' },
        }),
        choose('¿A qué te levantas?', ['What time do you get up?', 'Where do you sleep?', 'What do you eat?', 'Who wakes you?'], 'What time do you get up?', {
          vocab: { target: '¿a qué te levantas?', translation: 'what time do you get up?' },
        }),
        typeEx('Translate into Spanish', 'At six in the morning', ['a las seis de la mañana'], {
          hint: 'Hours use “a las” (feminine) + “de la” for the period of day.',
        }),
        speak('Me levanto a las siete y desayuno café con tostadas.'),
      ],
    },
    {
      title: 'Actividades del día',
      goal: 'Use the verbs that run your day',
      exercises: [
        choose('Me voy al trabajo.', ['I come back from work.', 'I go to work.', 'I like work.', 'Work is far.'], 'I go to work.', {
          vocab: { target: 'me voy', translation: 'I go / I leave' },
        }),
        typeEx('Translate into Spanish', 'I eat lunch', ['almuerzo', 'como el almuerzo'], {
          note: 'In Spain lunch is around 2–3pm; “almuerzo” is the meal itself.',
          vocab: { target: 'almuerzo', translation: 'I have lunch' },
        }),
        choose('Vuelvo a casa.', ['I leave home.', 'I come back home.', 'I clean the house.', 'I buy a house.'], 'I come back home.', {
          note: 'Volver = to come back (an -er verb: vuelvo, vuelves, vuelve…).',
        }),
        listen('Ceno a las nueve', ['ceno a las nueve', 'almuerzo a las nueve', 'ceno a las dos', 'desayuno a las nueve'], {
          note: 'Dinner at 9pm is normal across Spain and much of Latin America.',
        }),
        typeEx('Translate into Spanish', 'I study', ['estudio'], {
          vocab: { target: 'estudio', translation: 'I study' },
        }),
        choose('Duermo ocho horas.', ['I work eight hours.', 'I sleep eight hours.', 'I study eight hours.', 'I run eight hours.'], 'I sleep eight hours.'),
        typeEx('Translate into Spanish', 'I get dressed', ['me visto', 'visto'], {
          note: 'Another reflexive: vestirse — me visto, me vistes, se viste…',
        }),
        speak('Vuelvo a casa, ceno y estudio hasta las once.'),
      ],
    },
    {
      title: 'Frecuencia',
      goal: 'Say how often you do things',
      exercises: [
        choose('siempre', ['Never', 'Sometimes', 'Always', 'Rarely'], 'Always', {
          vocab: { target: 'siempre', translation: 'always' },
        }),
        typeEx('Translate into Spanish', 'Never', ['nunca'], {
          note: '“Nunca” anywhere in the sentence makes it negative: nunca como.',
          vocab: { target: 'nunca', translation: 'never' },
        }),
        choose('a veces', ['All the time', 'Sometimes', 'At times… no', 'At this time'], 'Sometimes', {
          vocab: { target: 'a veces', translation: 'sometimes' },
        }),
        listen('Normalmente desayuno en casa', ['normalmente desayuno en casa', 'normalmente ceno en casa', 'nunca desayuno en casa', 'siempre desayuno fuera']),
        typeEx('Translate into Spanish', 'Every day', ['todos los días', 'cada día'], {
          vocab: { target: 'todos los días', translation: 'every day' },
        }),
        choose('temprano', ['Late', 'Early', 'Fast', 'Soon'], 'Early', {
          vocab: { target: 'temprano', translation: 'early' },
        }),
        typeEx('Translate into Spanish', 'I usually run in the evening', ['normalmente corro por la tarde', 'suelo correr por la tarde'], {
          note: 'Frequency words (normalmente, siempre) sit BEFORE the verb.',
        }),
        speak('Siempre desayuno temprano y nunca me acuesto tarde.'),
      ],
    },
    {
      title: 'Preguntas sobre horarios',
      goal: 'Ask and answer questions about routine',
      exercises: [
        choose('¿Qué haces?', ['Where are you going?', 'What do you do?', 'What is it?', 'Who are you?'], 'What do you do?', {
          vocab: { target: '¿qué haces?', translation: 'what do you do?' },
        }),
        typeEx('Translate into Spanish', 'What time do you go to bed?', ['a qué hora te acuestas', '¿a qué hora te acuestas'], {
          hint: 'Acostarse (to lie down): me acuesto, te acuestas…',
          vocab: { target: 'te acuestas', translation: 'you go to bed' },
        }),
        choose('¿Trabajas?', ['Are you working?', 'Do you work?', 'Where do you work?', 'Do you like work?'], 'Do you work?', {
          note: 'No auxiliary needed — “¿trabajas?” is the whole question.',
        }),
        listen('¿Sales por la noche?', ['¿sales por la noche?', '¿sales por la mañana?', '¿vuelves por la noche?', '¿sales con alguien?']),
        typeEx('Translate into Spanish', 'Do you study every day?', ['estudias todos los días', '¿estudias todos los días'], {
          note: 'Spanish questions open with ¿ and end with ? — both marks matter.',
        }),
        choose('por la noche', ['In the morning', 'At night', 'In the afternoon', 'All day'], 'At night'),
        typeEx('Translate into Spanish', 'I do not have time', ['no tengo tiempo'], {
          vocab: { target: 'no tengo tiempo', translation: 'I do not have time' },
        }),
        speak('¿A qué hora sales de casa? Yo salgo a las ocho.'),
      ],
    },
  ],
};
