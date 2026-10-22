import { choose, typeEx, listen, speak } from '../helpers';
import type { ChapterSource } from '../../../lib/curriculum/types';

export const ch5: ChapterSource = {
  cefr: 'A1',
  title: 'La familia y la gente',
  description: 'Talk about family, describe people, and ask about them.',
  lessons: [
    {
      title: 'La familia',
      goal: 'Name the people closest to you',
      exercises: [
        choose('mi madre', ['My sister', 'My mother', 'My aunt', 'My daughter'], 'My mother', {
          vocab: { target: 'mi madre', translation: 'my mother' },
        }),
        typeEx('Translate into Spanish', 'My father', ['mi padre'], {
          vocab: { target: 'mi padre', translation: 'my father' },
        }),
        choose('hermano', ['Brother', 'Cousin', 'Uncle', 'Nephew'], 'Brother', {
          note: 'Hermano = brother, hermana = sister — “hermanos” covers both.',
          vocab: { target: 'hermano', translation: 'brother' },
        }),
        listen('Tengo dos hermanas', ['tengo dos hermanas', 'tengo dos hermanos', 'tengo dos abuelas', 'tengo una hermana']),
        typeEx('Translate into Spanish', 'My parents', ['mis padres'], {
          note: '“Padres” means parents (father + mother) — not just fathers.',
          vocab: { target: 'mis padres', translation: 'my parents' },
        }),
        choose('mis abuelos', ['My grandparents', 'My grandchildren', 'My uncles', 'My parents'], 'My grandparents', {
          vocab: { target: 'mis abuelos', translation: 'my grandparents' },
        }),
        typeEx('Translate into Spanish', 'My daughter', ['mi hija'], {
          vocab: { target: 'hija', translation: 'daughter' },
        }),
        speak('Tengo un hermano pequeño y dos primos.'),
      ],
    },
    {
      title: 'Describir personas',
      goal: 'Describe how people look',
      exercises: [
        choose('alto', ['Short', 'Tall', 'Thin', 'Young'], 'Tall', {
          vocab: { target: 'alto', translation: 'tall' },
        }),
        typeEx('Translate into Spanish', 'Beautiful', ['bonito', 'bonita', 'hermoso', 'hermosa'], {
          note: 'Bonito is everyday-beautiful; hermoso is stronger.',
        }),
        choose('moreno', ['Blonde', 'Dark-haired', 'Bald', 'Red-haired'], 'Dark-haired', {
          note: '“Moreno” can also be a warm compliment — and is common as a nickname.',
          vocab: { target: 'moreno', translation: 'dark-haired' },
        }),
        listen('Es muy simpática', ['es muy simpática', 'es muy simpático', 'es muy simple', 'no es simpática'], {
          note: 'The -a/-o ending shows the speaker’s gender when talking about yourself, but matches the person when describing them.',
        }),
        typeEx('Translate into Spanish', 'Young', ['joven'], {
          note: '“Joven” has one form for both genders: un chico joven, una chica joven.',
          vocab: { target: 'joven', translation: 'young' },
        }),
        choose('delgado', ['Fat', 'Thin', 'Strong', 'Old'], 'Thin', {
          vocab: { target: 'delgado', translation: 'thin' },
        }),
        typeEx('Translate into Spanish', 'He is old', ['es viejo', 'él es viejo'], {
          note: '“Mayor” is the polite way to say older; “viejo” can sound blunt about people.',
        }),
        speak('Mi hermana es alta, morena y muy simpática.'),
      ],
    },
    {
      title: 'Carácter',
      goal: 'Describe personality, not just looks',
      exercises: [
        choose('simpático', ['Mean', 'Nice / friendly', 'Shy', 'Boring'], 'Nice / friendly', {
          note: 'One of the best Spanish compliments — “es simpático” means easy to be around.',
          vocab: { target: 'simpático', translation: 'nice / friendly' },
        }),
        typeEx('Translate into Spanish', 'Funny', ['gracioso', 'divertido', 'graciosa', 'divertida'], {
          vocab: { target: 'gracioso', translation: 'funny' },
        }),
        choose('tímido', ['Confident', 'Shy', 'Angry', 'Chatty'], 'Shy', {
          vocab: { target: 'tímido', translation: 'shy' },
        }),
        listen('Es muy amable', ['es muy amable', 'es muy amargo', 'no es amable', 'es muy amistoso'], {
          note: '“Amable” means kind — from “amable” (lovable).',
        }),
        typeEx('Translate into Spanish', 'Serious', ['serio', 'seria'], {
          vocab: { target: 'serio', translation: 'serious' },
        }),
        choose('antipático', ['Unpleasant / unfriendly', 'Sympathetic', 'Friendly', 'Odd'], 'Unpleasant / unfriendly', {
          note: 'Antipático is the opposite of simpático — a very common word.',
        }),
        typeEx('Translate into Spanish', 'He is very patient', ['es muy paciente', 'él es muy paciente'], {
          note: 'Personality uses “ser”: es amable, es paciente, es gracioso.',
        }),
        speak('Es tranquila, divertida y muy paciente.'),
      ],
    },
    {
      title: 'Hablar de los demás',
      goal: 'Ask about and describe other people',
      exercises: [
        choose('¿Tienes hermanos?', ['Do you have children?', 'Do you have siblings?', 'Do you have brothers only?', 'Do you have friends?'], 'Do you have siblings?', {
          note: '“Hermanos” is inclusive — brothers OR sisters.',
          vocab: { target: '¿tienes hermanos?', translation: 'do you have siblings?' },
        }),
        typeEx('Translate into Spanish', 'How old are you?', ['qué edad tienes', '¿qué edad tienes'], {
          note: 'Literally “what age do you have?” — age is had, not is.',
          vocab: { target: 'qué edad tienes', translation: 'how old are you' },
        }),
        choose('Está casado', ['He is single', 'He is married', 'He is tired', 'He is at home'], 'He is married', {
          note: 'Casado (m) / casada (f) — match the person.',
          vocab: { target: 'casado', translation: 'married' },
        }),
        listen('Tiene el pelo largo', ['tiene el pelo largo', 'tiene el pelo corto', 'tiene los ojos verdes', 'tiene la cabeza grande'], {
          note: 'Features use “tener”: pelo largo, ojos verdes.',
        }),
        typeEx('Translate into Spanish', 'She has green eyes', ['tiene los ojos verdes'], {
          note: 'Features use “tener”: tiene los ojos verdes, tiene el pelo rizado.',
          vocab: { target: 'tiene los ojos verdes', translation: 'she has green eyes' },
        }),
        choose('¿Es alto?', ['Is he tall?', 'Is he old?', 'Is he working?', 'Is he here?'], 'Is he tall?'),
        typeEx('Translate into Spanish', 'They are my friends', ['son mis amigos'], {
          note: '“Son” for they are — same word as “they are” in Soy / Eres / Son.',
        }),
        speak('Mi madre es mayor y muy paciente; mi hermano es tímido.'),
      ],
    },
  ],
};
