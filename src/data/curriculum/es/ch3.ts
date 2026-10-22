import { choose, typeEx, listen, speak } from '../helpers';
import type { ChapterSource } from '../../../lib/curriculum/types';

export const ch3: ChapterSource = {
  cefr: 'A1',
  title: 'En el café',
  description: 'Order like a regular — drinks, food, prices, and preferences.',
  lessons: [
    {
      title: 'Bebidas',
      goal: 'Order any drink politely',
      exercises: [
        choose('Un café, por favor.', ['A coffee, please.', 'A table for two.', 'The bill, please.', 'Black coffee.'], 'A coffee, please.', {
          note: '“Por favor” after the item is all the politeness you need.',
          vocab: { target: 'por favor', translation: 'please' },
        }),
        typeEx('Translate into Spanish', 'A glass of water', ['un vaso de agua'], {
          hint: 'Glass = vaso, water = agua.',
          vocab: { target: 'un vaso de agua', translation: 'a glass of water' },
        }),
        choose('con leche', ['Without sugar', 'With milk', 'Very hot', 'Cold water'], 'With milk', {
          note: '“Con” = with, “sin” = without — the two most useful words at a counter.',
          vocab: { target: 'con leche', translation: 'with milk' },
        }),
        listen('Un té sin azúcar', ['un té sin azúcar', 'un té con leche', 'un café con leche', 'un vaso de agua']),
        typeEx('Translate into Spanish', 'I want a coffee', ['quiero un café', 'quiero un cafe'], {
          note: '“Quiero” is direct; add “por favor” and it’s perfectly warm.',
          vocab: { target: 'quiero', translation: 'I want' },
        }),
        choose('¿Algo más?', ['Anything else?', 'How much?', 'What is it?', 'Where is it?'], 'Anything else?'),
        typeEx('Translate into Spanish', 'I would like a tea', ['quisiera un té', 'quiero un té', 'quisiera un te'], {
          hint: '“Quisiera” is the polite form of “quiero” — very common when ordering.',
        }),
        speak('Un café con leche y un vaso de agua, por favor.'),
      ],
    },
    {
      title: 'La comida',
      goal: 'Talk about food and hunger',
      exercises: [
        choose('un bocadillo', ['A drink', 'A sandwich', 'A dessert', 'A plate'], 'A sandwich', {
          note: 'In Spain a “bocadillo” is a baguette sandwich; in Latin America “sándwich” is the usual word.',
          vocab: { target: 'bocadillo', translation: 'sandwich' },
        }),
        typeEx('Translate into Spanish', 'I am hungry', ['tengo hambre'], {
          note: 'Hunger is had, not had-hunger: “tener hambre”.',
          vocab: { target: 'tengo hambre', translation: 'I am hungry' },
        }),
        choose('La cuenta, por favor.', ['The menu, please.', 'The bill, please.', 'A fork, please.', 'The table, please.'], 'The bill, please.', {
          vocab: { target: 'la cuenta', translation: 'the bill' },
        }),
        listen('¿Qué quieres comer?', ['¿qué quieres comer?', '¿qué quieres beber?', '¿qué te gusta?', 'quiero comer']),
        typeEx('Translate into Spanish', 'The bill', ['la cuenta'], {
          hint: 'Same word as “account” — your bill is “the count”.',
        }),
        choose('Está delicioso.', ['It is expensive.', 'It is delicious.', 'It is cold.', 'It is ready.'], 'It is delicious.', {
          note: 'Food “está” delicioso (it is being delicious right now) rather than “es”.',
          vocab: { target: 'delicioso', translation: 'delicious' },
        }),
        typeEx('Translate into Spanish', 'I am thirsty', ['tengo sed'], {
          note: 'Same pattern as hunger: “tener sed”.',
          vocab: { target: 'tengo sed', translation: 'I am thirsty' },
        }),
        speak('Tengo hambre. ¿Qué me recomienda?'),
      ],
    },
    {
      title: 'Precios',
      goal: 'Ask prices and react to them',
      exercises: [
        choose('¿Cuánto cuesta?', ['How much is it?', 'What is it?', 'Where is it?', 'How old is it?'], 'How much is it?', {
          vocab: { target: '¿cuánto cuesta?', translation: 'how much is it?' },
        }),
        typeEx('Translate into Spanish', 'It is five euros', ['son cinco euros', 'cuesta cinco euros'], {
          hint: 'Plural items use “son”, single items “cuesta”.',
        }),
        choose('caro', ['Cheap', 'Expensive', 'Fresh', 'Big'], 'Expensive', {
          vocab: { target: 'caro', translation: 'expensive' },
        }),
        listen('barato', ['barato', 'caro', 'bueno', 'raro'], {
          note: '“Barato” and “caro” are a natural pair — memorize them together.',
        }),
        typeEx('Translate into Spanish', 'Cheap', ['barato', 'barata'], {
          note: 'Gender your adjective: barato (m) / barata (f).',
        }),
        choose('¿Es gratis?', ['Is it free?', 'Is it cold?', 'Is it open?', 'Is it far?'], 'Is it free?', {
          vocab: { target: 'gratis', translation: 'free' },
        }),
        choose('¿Cuánto es?', ['How many are there?', 'How much is it (total)?', 'How do you pay?', 'How old are you?'], 'How much is it (total)?', {
          note: '“Cuesta” for one item, “es” for the total bill.',
        }),
        speak('Perdón, ¿cuánto cuesta el bocadillo?'),
      ],
    },
    {
      title: 'Gustos y preferencias',
      goal: 'Say what you like and love',
      exercises: [
        choose('Me gusta el chocolate.', ['I like chocolate.', 'I have chocolate.', 'I make chocolate.', 'Chocolate, please.'], 'I like chocolate.', {
          note: '“Me gusta” + singular noun. Two or more? “Me gustan los chocolates”.',
          vocab: { target: 'me gusta', translation: 'I like' },
        }),
        typeEx('Translate into Spanish', 'I do not like coffee', ['no me gusta el café', 'no me gusta café', 'no me gusta el cafe'], {
          hint: 'Negation goes before: “no me gusta…”.',
        }),
        choose('prefiero el té', ['I like tea more than…', 'I prefer tea', 'I make tea', 'Tea, please'], 'I prefer tea', {
          vocab: { target: 'prefiero', translation: 'I prefer' },
        }),
        listen('Me encanta la música', ['me encanta la música', 'me gusta la música', 'amo la comida', 'no me gusta la música'], {
          note: '“Me encanta” is stronger than “me gusta” — love, not like.',
        }),
        typeEx('Translate into Spanish', 'I love it', ['me encanta', 'me encanta mucho'], {
          vocab: { target: 'me encanta', translation: 'I love it' },
        }),
        choose('No me gusta nada.', ['I like everything.', 'I do not like it at all.', 'Nothing is good.', 'I don’t want anything.'], 'I do not like it at all.', {
          note: '“Nada” after the verb makes the negative total: not at all.',
        }),
        typeEx('Translate into Spanish', 'I like reading', ['me gusta leer'], {
          note: '“Me gusta” + infinitive verb: me gusta leer, me gusta cocinar.',
        }),
        speak('Me encanta la comida mexicana, ¿y a ti?'),
      ],
    },
  ],
};
