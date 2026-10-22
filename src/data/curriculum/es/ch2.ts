import { choose, typeEx, listen, speak } from '../helpers';
import type { ChapterSource } from '../../../lib/curriculum/types';

export const ch2: ChapterSource = {
  cefr: 'A1',
  title: 'Números, días y la hora',
  description: 'Count to 100, name the days, and tell time without thinking.',
  lessons: [
    {
      title: 'Del cero al treinta',
      goal: 'Recognize and write numbers 0–30',
      exercises: [
        typeEx('Write the number in Spanish', 'five', ['cinco'], {
          vocab: { target: 'cinco', translation: 'five' },
        }),
        choose('trece', ['Three', 'Thirteen', 'Thirty', 'Threeteen'], 'Thirteen', {
          note: '-ce numbers: trece, catorce, quince, veinte.',
          vocab: { target: 'trece', translation: 'thirteen' },
        }),
        typeEx('Write the number in Spanish', 'twenty', ['veinte'], {
          vocab: { target: 'veinte', translation: 'twenty' },
        }),
        listen('siete', ['siete', 'seis', 'diez', 'once']),
        choose('ocho', ['Eight', 'Eighty', 'Six', 'Ninety'], 'Eight'),
        typeEx('Write the number in Spanish', 'ten', ['diez'], {
          vocab: { target: 'diez', translation: 'ten' },
        }),
        choose('quince', ['Five', 'Fifty', 'Fifteen', 'Sixty'], 'Fifteen', {
          note: 'Eleven to fifteen: once, doce, trece, catorce, quince — then dieciséis, diecisiete…',
          vocab: { target: 'quince', translation: 'fifteen' },
        }),
        speak('Tengo veintiún años.'),
      ],
    },
    {
      title: 'Del treinta al cien',
      goal: 'Handle prices, ages, and bigger numbers',
      exercises: [
        choose('cuarenta', ['Fourteen', 'Four', 'Forty', 'Fourth'], 'Forty', {
          vocab: { target: 'cuarenta', translation: 'forty' },
        }),
        typeEx('Write the number in Spanish', 'fifty', ['cincuenta'], {
          note: 'Tens end in -enta: treinta, cuarenta, cincuenta, sesenta…',
          vocab: { target: 'cincuenta', translation: 'fifty' },
        }),
        choose('sesenta', ['Sixth', 'Sixty', 'Sixteen', 'Six'], 'Sixty'),
        listen('setenta', ['setenta', 'sesenta', 'ochenta', 'veinte']),
        typeEx('Write the number in Spanish', 'eighty', ['ochenta'], {
          vocab: { target: 'ochenta', translation: 'eighty' },
        }),
        choose('noventa', ['Ninety', 'Nine', 'Nineteen', 'Ninth'], 'Ninety'),
        typeEx('Write the number in Spanish', 'one hundred', ['cien', 'ciento'], {
          note: 'Exactly 100 = “cien”; 101+ = “ciento uno, ciento dos…”',
          vocab: { target: 'cien', translation: 'one hundred' },
        }),
        choose('treinta y uno', ['Thirteen', 'Thirty-one', 'Three', 'Thirteen-one'], 'Thirty-one', {
          note: 'Tens and units join with “y”: treinta y uno, cuarenta y cinco.',
        }),
      ],
    },
    {
      title: '¿Qué hora es?',
      goal: 'Tell and ask the time',
      exercises: [
        choose('¿Qué hora es?', ['Where is the hour?', 'What time is it?', 'How long is it?', 'What day is it?'], 'What time is it?', {
          vocab: { target: '¿qué hora es?', translation: 'what time is it?' },
        }),
        typeEx('Translate into Spanish', "It's three o'clock", ['son las tres'], {
          hint: 'Clock hours are feminine: “son las”.',
          vocab: { target: 'son las tres', translation: "it's three o'clock" },
        }),
        choose('Es la una', ["It's one o'clock", "It's two o'clock", 'It’s half past one', 'It’s late'], "It's one o'clock", {
          note: 'La una is singular — only 1 o’clock uses “es la”.',
        }),
        listen('Son las dos y media', ['son las dos y media', 'son las dos en punto', 'son las tres y media', 'es la una'], {
          note: '“Y media” = half past.',
        }),
        typeEx('Translate into Spanish', 'Half past two', ['son las dos y media', 'las dos y media'], {
          vocab: { target: 'y media', translation: 'half past' },
        }),
        choose('y cuarto', ['Half past', 'Quarter past', 'O’clock', 'Ten past'], 'Quarter past', {
          vocab: { target: 'y cuarto', translation: 'quarter past' },
        }),
        choose('en punto', ['Exactly', 'Late', 'Early', 'Half past'], 'Exactly', {
          note: '“Tres en punto” = three o’clock sharp.',
          vocab: { target: 'en punto', translation: 'exactly (o’clock)' },
        }),
        speak('Son las ocho y cuarto de la mañana.'),
      ],
    },
    {
      title: 'Días y meses',
      goal: 'Name days, months, and when things happen',
      exercises: [
        choose('lunes', ['Sunday', 'Monday', 'Saturday', 'Tuesday'], 'Monday'),
        typeEx('Write the day in Spanish', 'Wednesday', ['miércoles'], {
          hint: 'The accent sits on the first e.',
          vocab: { target: 'miércoles', translation: 'Wednesday' },
        }),
        listen('viernes', ['viernes', 'lunes', 'martes', 'domingo']),
        choose('el sábado', ['Friday', 'Thursday', 'Saturday', 'Sunday'], 'Saturday'),
        typeEx('Write the day in Spanish', 'Sunday', ['domingo'], {
          vocab: { target: 'domingo', translation: 'Sunday' },
        }),
        choose('enero', ['June', 'January', 'July', 'April'], 'January'),
        typeEx('Write the month in Spanish', 'December', ['diciembre'], {
          note: 'Days and months are NOT capitalized in Spanish: lunes, enero.',
          vocab: { target: 'diciembre', translation: 'December' },
        }),
        choose('¿A qué día estamos?', ['What time is it?', 'What day is it?', 'What is the date?', 'What month is it?'], 'What day is it?'),
      ],
    },
  ],
};
