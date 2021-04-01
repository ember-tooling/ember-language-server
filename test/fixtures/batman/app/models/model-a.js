import DS from 'ember-data';

export default DS.Model.extend({

  modelB: DS.hasMany('model-b'),

  someAttr: DS.attr('custom-transform')

});
