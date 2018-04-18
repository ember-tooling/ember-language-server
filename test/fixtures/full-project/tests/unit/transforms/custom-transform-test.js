import { module, test } from 'qunit';
import { setupTest } from 'ember-qunit';

module('transform:custom-transform', 'Unit | Transform | custom transform', function(hooks) {
  setupTest(hooks);

  // Replace this with your real tests.
  test('it exists', function(assert) {
    let transform = this.owner.lookup('transform:custom-transform');
    assert.ok(transform);
  });
});
