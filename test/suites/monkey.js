/**
 * Baobab Monkey Unit Tests
 * =========================
 */
import assert from 'assert';
import Baobab, {monkey} from '../../src/baobab';
import {MonkeyDefinition} from '../../src/monkey';
import type from '../../src/type';
import _ from 'lodash';

const noop = Function.prototype;

const getExampleState = () => ({
  data: {
    messages: [
      {from: 'John', message: 'Hey'},
      {from: 'Jack', message: 'Ho'}
    ],
    fromJohn: monkey({
      cursors: {
        messages: ['data', 'messages']
      },
      get: function({messages}) {
        return _.filter(messages, {from: 'John'});
      }
    })
  }
});

describe('Monkeys', function() {

  it('the monkey definition type should work correctly.', function() {
    const validObject = {cursors: {a: ['one']}, get: noop},
          validArray = [['one'], noop],
          invalidObject = {hello: 'world'},
          invalidArray = ['so crisp!'];

    assert.strictEqual(type.monkeyDefinition(validObject), 'object');
    assert.strictEqual(type.monkeyDefinition(validArray), 'array');
    assert.strictEqual(type.monkeyDefinition(invalidObject), null);
    assert.strictEqual(type.monkeyDefinition(invalidArray), null);
  });

  it('should be possible to create monkey definitions from objects.', function() {
    const objectNode = monkey({cursors: {a: ['one']}, get: noop}),
          arrayNode = monkey([['one'], noop]);

    assert(objectNode instanceof MonkeyDefinition);
    assert(arrayNode instanceof MonkeyDefinition);

    assert.throws(function() {
      monkey({hello: 'world'});
    }, /invalid/);
  });

  it('should be possible to create monkeys at instantiation.', function() {
    const tree = new Baobab(getExampleState());

    assert.deepEqual(
      tree.get('data', 'fromJohn'),
      [{from: 'John', message: 'Hey'}]
    );
  });

  it('should be possible to create monkeys using a shorthand.', function() {
    const tree = new Baobab({
      data: {
        messages: [
          {from: 'John', message: 'Hey'},
          {from: 'Jack', message: 'Ho'}
        ],
        greeting: 'Hello',
        custom: monkey(
          ['data', 'messages'],
          ['data', 'greeting'],
          function(messages, greeting) {
            return greeting + ' ' + messages[0].from;
          }
        )
      }
    });

    assert.strictEqual(tree.get('data', 'custom'), 'Hello John');
  });

  it('computed data should be immutable.', function() {
    const tree = new Baobab(getExampleState()),
          computedData = tree.get('data', 'fromJohn');

    assert.isFrozen(computedData);
  });

  it('should be possible to access data from beyond monkeys.', function() {
    const tree = new Baobab(getExampleState());

    assert.strictEqual(
      tree.get('data', 'fromJohn', 0, 'message'),
      'Hey'
    );
  });

  it('monkeys should update when their dependencies update.', function() {
    const tree = new Baobab(getExampleState());

    assert.deepEqual(
      tree.get('data', 'fromJohn'),
      [{from: 'John', message: 'Hey'}]
    );

    tree.push(['data', 'messages'], {from: 'John', message: 'Success!'});

    assert.deepEqual(
      tree.get('data', 'fromJohn'),
      [{from: 'John', message: 'Hey'}, {from: 'John', message: 'Success!'}]
    );
  });

  it('monkeys should be able to work with dynamic paths.', function() {
    const tree = new Baobab(
      {
        list: [{id: 1, name: 'John'}],
        greeting: monkey({
          cursors: {
            person: ['list', {id: 1}]
          },
          get({person: {name}}) {
            return `Hello ${name}`;
          }
        })
      }
    );

    assert.strictEqual(tree.get('greeting'), 'Hello John');

    tree.set(['list', 0, 'name'], 'Jack')

    assert.strictEqual(tree.get('greeting'), 'Hello Jack');
  });

  it('cursors with a monkey in the path should work correctly.', function(done) {
    const tree = new Baobab(getExampleState()),
          cursor = tree.select('data', 'fromJohn');

    cursor.on('update', e => done());

    assert.deepEqual(
      cursor.get(),
      [{from: 'John', message: 'Hey'}]
    );

    tree.push(['data', 'messages'], {from: 'John', message: 'Success!'});

    assert.deepEqual(
      cursor.get(),
      [{from: 'John', message: 'Hey'}, {from: 'John', message: 'Success!'}]
    );
  });

  it('cursors should be able to listen to beyond monkeys.', function() {
    const tree = new Baobab(getExampleState()),
          cursor = tree.select('data', 'fromJohn', 0, 'message');

    assert.strictEqual(
      cursor.get(),
      'Hey'
    );
  });

  it('getting a higher key should correctly solve computed data.', function() {
    const tree = new Baobab(getExampleState());

    assert.deepEqual(
      tree.get(),
      {
        data: {
          messages: [
            {from: 'John', message: 'Hey'},
            {from: 'Jack', message: 'Ho'}
          ],
          fromJohn: [{from: 'John', message: 'Hey'}]
        }
      }
    );

    assert.deepEqual(
      tree.get('data'),
      {
        messages: [
          {from: 'John', message: 'Hey'},
          {from: 'Jack', message: 'Ho'}
        ],
        fromJohn: [{from: 'John', message: 'Hey'}]
      }
    );
  });

  it('should be possible to serialize the tree or some of its parts.', function() {
    const tree = new Baobab(getExampleState());

    assert.deepEqual(
      tree.serialize(),
      {
        data: {
          messages: [
            {from: 'John', message: 'Hey'},
            {from: 'Jack', message: 'Ho'}
          ]
        }
      }
    );

    assert.deepEqual(
      tree.serialize('data'),
      {
        messages: [
          {from: 'John', message: 'Hey'},
          {from: 'Jack', message: 'Ho'}
        ]
      }
    );

    assert.deepEqual(
      tree.select('data').serialize(),
      {
        messages: [
          {from: 'John', message: 'Hey'},
          {from: 'Jack', message: 'Ho'}
        ]
      }
    );
  });

  it('should work recursively.', function(done) {
    const inc = x => x + 1;

    const tree = new Baobab({
      data: {
        number: 1
      },
      computed: {
        one: monkey(['data', 'number'], inc),
        two: monkey(['computed', 'one'], inc)
      }
    });

    assert.strictEqual(tree.get('computed', 'one'), 2);
    assert.strictEqual(tree.get('computed', 'two'), 3);

    tree.select('data', 'number').on('update', () => {
      assert.strictEqual(tree.get('computed', 'one'), 6);
      assert.strictEqual(tree.get('computed', 'two'), 7);
      done();
    });

    tree.set(['data', 'number'], 5);
  });

  it('recursivity should take updates into account.', function() {
    let count = 0;

    const tree = new Baobab({
      rows: [1, 2, 3, 4, 5],
      visibleRows: {start: 0, end: 0},
      rowLength: monkey([
        ['rows'],
        function(rows) {
          return rows.length;
        }
      ]),
      specialRows: monkey([
        ['rows'],
        function(rows) {
          return rows;
        }
      ]),
      visibleRowsData: monkey([
        ['specialRows'],
        ['visibleRows'],
        function(specialRows, visibleRows) {
          count++;
          return specialRows.slice(visibleRows.start, visibleRows.end);
        }
      ]),
    }, {asynchronous: false});

    tree.get('visibleRowsData');
    tree.select('visibleRows').set({start:1, end:4});
    tree.get('visibleRowsData');

    assert.strictEqual(count, 2);
  });

  it('data retrieved through facets should be immutable by default.', function() {
    const tree = new Baobab(getExampleState()),
          data = tree.get();

    assert.isFrozen(data.data);
    assert.isFrozen(data.data.fromJohn);
    assert.isFrozen(data.data.fromJohn[0]);

    const mutableTree = new Baobab(getExampleState(), {immutable: false}),
          mutableData = mutableTree.get();

    assert.isNotFrozen(mutableData.data);
    assert.isNotFrozen(mutableData.data.fromJohn);
    assert.isNotFrozen(mutableData.data.fromJohn[0]);
  });
});