import { choose, typeEx, listen, speak } from '@/data/curriculum/helpers';
import type { ChapterSource } from '@/lib/curriculum/types';

export const ch1: ChapterSource = {
  cefr: 'A1',
  title: 'Saludos y presentaciones',
  description: 'Say hello, introduce yourself, and say goodbye like a local.',
  lessons: [
    {
      title: 'Saludos básicos',
      goal: 'Greet anyone at any time of day',
      exercises: [
        choose('Hola', ['Hello', 'Goodbye', 'Please', 'Thanks'], 'Hello', {
          note: '“Hola” works morning or night — the most universal Spanish greeting.',
        }),
        choose('Buenos días', ['Good night', 'Good morning', 'Good afternoon', 'See you'], 'Good morning', {
          note: 'In Spain “buenos días” lasts until about 2pm; then switch to “buenas tardes”.',
        }),
        typeEx('Translate into Spanish', 'Good afternoon', ['buenas tardes'], {
          hint: '“Tardes” comes from “tarde” (afternoon / late).',
          vocab: { target: 'buenas tardes', translation: 'good afternoon' },
        }),
        listen('Buenas noches', ['buenas noches', 'buenas tardes', 'buenos días', 'hasta luego'], {
          note: '“Buenas noches” covers both good evening and good night.',
        }),
        choose('¿Qué tal?', ['How are you?', 'Where are you from?', 'What is your name?', 'See you later'], 'How are you?', {
          hint: 'Literally “how about it?” — used all day, every day.',
          vocab: { target: '¿qué tal?', translation: 'how are you?' },
        }),
        typeEx('Translate into Spanish', 'Goodbye', ['adiós', 'adios'], {
          vocab: { target: 'adiós', translation: 'goodbye' },
        }),
        choose('Buenas tardes', ['Good evening', 'Good morning', 'Good night', 'Good afternoon'], 'Good afternoon', {
          note: 'From 2pm until sunset: “buenas tardes”.',
        }),
        speak('— ¿Qué tal? — ¡Bien, gracias!'),
      ],
    },
    {
      title: 'Me llamo…',
      goal: 'Introduce yourself and ask for names',
      exercises: [
        choose('Me llamo Ana.', ['My name is Ana.', 'I am Ana.', 'I like Ana.', 'Ana is here.'], 'My name is Ana.', {
          note: '“Me llamo” literally means “I call myself”.',
        }),
        typeEx('Translate into Spanish', 'My name is Carlos', ['me llamo carlos'], {
          hint: 'Say it as “me llamo Carlos”.',
          vocab: { target: 'me llamo', translation: 'my name is' },
        }),
        choose('¿Cómo te llamas?', ['How old are you?', 'What is your name?', 'Where are you from?', 'How are you?'], 'What is your name?', {
          vocab: { target: '¿cómo te llamas?', translation: 'what is your name?' },
        }),
        listen('Mucho gusto', ['mucho gusto', 'muchas gracias', 'muy bien', 'hasta luego'], {
          note: '“Mucho gusto” is “nice to meet you” — “encantado/encantada” says the same.',
          vocab: { target: 'mucho gusto', translation: 'nice to meet you' },
        }),
        typeEx('Translate into Spanish', 'Nice to meet you', ['mucho gusto', 'encantado', 'encantada'], {
          note: '“Encantado” if you’re male, “encantada” if you’re female.',
        }),
        choose('¿De dónde eres?', ['How old are you?', 'What do you do?', 'Where are you from?', 'What is your name?'], 'Where are you from?', {
          vocab: { target: '¿de dónde eres?', translation: 'where are you from?' },
        }),
        typeEx('Translate into Spanish', 'I am from Mexico', ['soy de méxico', 'soy de mexico'], {
          hint: 'Use “soy de…” + country.',
          vocab: { target: 'soy de…', translation: 'I am from…' },
        }),
        speak('Hola, me llamo Lucía. ¿Cómo te llamas?'),
      ],
    },
    {
      title: 'Nacionalidades y profesiones',
      goal: 'Say who you are and what you do',
      exercises: [
        choose('Soy profesor.', ['I am a teacher.', 'I am a student.', 'I am a doctor.', 'I am from Spain.'], 'I am a teacher.', {
          note: 'Jobs use “ser”: soy profesor / soy profesora.',
        }),
        typeEx('Translate into Spanish', 'I am a student', ['soy estudiante'], {
          vocab: { target: 'estudiante', translation: 'student' },
        }),
        choose('¿A qué te dedicas?', ['Where do you live?', 'What do you do for work?', 'How old are you?', 'What do you eat?'], 'What do you do for work?', {
          note: 'The natural way to ask someone’s job — literally “what do you dedicate yourself to?”',
          vocab: { target: '¿a qué te dedicas?', translation: 'what do you do for work?' },
        }),
        typeEx('Translate into Spanish', 'I am Mexican', ['soy mexicano', 'soy mexicana'], {
          note: 'Adjectives match your gender: mexicano (m) / mexicana (f).',
          vocab: { target: 'mexicano/a', translation: 'Mexican' },
        }),
        listen('Soy de Colombia', ['soy de colombia', 'soy colombiano', 'soy estudiante', 'soy de españa']),
        choose('Ingeniero', ['Teacher', 'Engineer', 'Doctor', 'Farmer'], 'Engineer', {
          vocab: { target: 'ingeniero', translation: 'engineer' },
        }),
        typeEx('What is a doctor called in Spanish?', 'doctor', ['médico', 'medico'], {
          note: 'Across Latin America, doctors are “médicos”; “doctor” works as a title everywhere.',
          vocab: { target: 'médico', translation: 'doctor' },
        }),
        speak('Soy ingeniero y soy de Argentina.'),
      ],
    },
    {
      title: 'Despedirse',
      goal: 'Leave a conversation warmly',
      exercises: [
        choose('Hasta luego', ['See you later', 'Good morning', 'Thank you', 'Come in'], 'See you later', {
          vocab: { target: 'hasta luego', translation: 'see you later' },
        }),
        typeEx('Translate into Spanish', 'Good night', ['buenas noches'], {
          vocab: { target: 'buenas noches', translation: 'good night' },
        }),
        choose('Adiós', ['Please', 'Goodbye', 'Hello', 'Sorry'], 'Goodbye'),
        listen('Nos vemos', ['nos vemos', 'hasta mañana', 'muchas gracias', 'buenos días'], {
          note: '“Nos vemos” (we’ll see each other) is casual and very common.',
        }),
        typeEx('Translate into Spanish', 'Take care', ['cuídate', 'cuidate'], {
          hint: 'From “cuidar” (to take care) — the accent moves when you add -te.',
        }),
        choose('Hasta mañana', ['See you tomorrow', 'Good night', 'See you later', 'Good afternoon'], 'See you tomorrow', {
          vocab: { target: 'hasta mañana', translation: 'see you tomorrow' },
        }),
        choose('Buenas noches', ['Good morning', 'Good night', 'Good afternoon', 'Goodbye'], 'Good night'),
        speak('Adiós, hasta luego. ¡Que te vaya bien!'),
      ],
    },
  ],
};
