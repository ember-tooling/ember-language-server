import DS from 'ember-data';

export default DS.Model.extend({

  modelB: DS.belongsTo('model-a')

});
