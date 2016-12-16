// localStorage persistence
var STORAGE_KEY = 's a m p l r 1 7'
Vue.use(VueYouTubeEmbed)
window.stems = {}
window.active_pads = {}
window.unassigned_pads = ['q','w','e','r','a','s','d','f','z','x','c','v']

var sampleStorage = {
  fetch: function () {
    var samples = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    samples.forEach(function (sample, index) {
      sample.index = index
    })
    sampleStorage.uid = samples.length
    return samples
  },
  save: function (samples) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(samples))
  }
}
// visibility filters
var filters = {
  all: function (samples) {
    return samples
  },
  active: function (samples) {
    return samples.filter(function (sample) {
      return active_pads.hasOwnProperty(sample.trigger) && active_pads[sample.trigger]
    })
  }
}
// app Vue instance
var samplr = new Vue({
  // app initial state
  data: {
    samples: sampleStorage.fetch(),
    newsample: {},
    adding: false,
    editedsample: {},
    editing: false,
    visibility: 'all'
  },
  // watch samples change for localStorage persistence
  watch: {
    samples: {
      handler: function (samples) {
        sampleStorage.save(samples)
      },
      deep: true
    },editedsample:{
      handler: function (sample) {
        var oldSample=this.beforeEditCache;
        if (!sample){
          return;
        }
        if (window.stems && sample && oldSample && oldSample.trigger && sample.trigger && oldSample.trigger != sample.trigger){
          Object.defineProperty(stems, sample.trigger,Object.getOwnPropertyDescriptor(stems, oldSample.trigger));
          delete stems[oldSample.trigger]
        }
      }
    }
  },
  // computed properties
  // http://vuejs.org/guide/computed.html
  computed: {
    hash_present:function(){
      return window.hash_state.length!=0;
    },
    serialized:function(){
      return window.location.origin+"/#"+encodeURIComponent(JSON.stringify(this.samples));
    },
    filteredsamples: function () {
      return filters[this.visibility](this.samples)
    },
    remaining: function () {
      return filters.active(this.samples).length
    },
    allDone: {
      get: function () {
        return this.remaining === 0
      },
      set: function (value) {
        this.samples.forEach(function (sample) {
          sample.discounted = value
        })
      }
    }
  },
  filters: {
    pluralize: function (n) {
      return n === 1 ? 'sample' : 'samples'
    }
  },
  methods: {
    seconds:function(sample){
      return (sample.end-sample.start).toFixed(0);
    },
    loadHashState:function(){
      if (confirm('Do you want to overwrite the pad with what is in the hash?')){
        this.samples = JSON.parse(hash_state);
      }
    },
    ready:function(player){
      var trigger = player.b.c.playerVars.trigger;
      player.clip_id =function(){
        return player.b.c.playerVars.clip_id;
      };
      player.start = function(){
        return player.b.c.playerVars.start;
      }
      player.start = function(){
        return player.b.c.playerVars.start;
      }
      console.log(trigger,'ready',player.clip_id());
      window.stems[trigger] = player
      window.active_pads[trigger]=false;
      window.unassigned_pads.splice(trigger,1);
      player.playVideo();
      player.pauseVideo();
    },
    duplicate:function(sample){
      var value = sample
      if (!value || !value.trigger || !value.start || !value.id) {
        return
      }
      this.samples.push({
        id: value.id,
        trigger: window.unassigned_pads.pop(),
        start: value.start,
        end: value.end,
        loop: value.loop
      })
    },
    trigger:function(key){
      var clip_launcher = stems[key];
      if (!clip_launcher||active_pads==true){
        return;
      }
      var sample = this.samples[clip_launcher.clip_id()];
      if (!window.active_pads[sample.trigger]){
        clip_launcher.playVideo();
        clip_launcher.seekTo(sample.start)
      }else{
        return;
      }
      window.active_pads[key]=true;
      if(!sample.loop && sample.end > sample.start){
        //set timeout to decay sample
        if (clip_launcher.hasOwnProperty('timeout')){
          clearTimeout(clip_launcher.timeout);
          delete clip_launcher.timeout;
        }
        var remaining = sample.end-sample.start;
        clip_launcher.timeout = setTimeout(function(){
          samplr.decay(key);
        },1000 * remaining);
      }else if(sample.loop && sample.end > sample.start){
        //loop sample
        if (clip_launcher.hasOwnProperty('loop')){
          clearInterval(clip_launcher.loop);
          delete clip_launcher.loop;
        }
        var remaining = sample.end-sample.start;
        clip_launcher.loop = setInterval(function(){
          samplr.trigger(key);
        },1000 * remaining);

      }
    },
    setStartNow:function(key){
      var clip_launcher = stems[key];
      var sample = this.samples[clip_launcher.clip_id()];
      sample.start=clip_launcher.getCurrentTime();
      clip_launcher.start=sample.start;
    },
    release:function(key){
      var clip_launcher = stems[key];
      if (!clip_launcher){
        return;
      }
      var sample = this.samples[clip_launcher.clip_id()];
      if (sample.end < clip_launcher.getCurrentTime())
      {
        this.decay(key);
      }

    },
    decay:function(key){
      var clip_launcher = stems[key];
      if (active_pads.hasOwnProperty(key) && active_pads[key]){
        return;
      }
      if (clip_launcher){
        clip_launcher.pauseVideo();
      }
    },
    toggleloop:function(key){
      var clip_launcher = stems[key];
      var sample = this.samples[clip_launcher.clip_id()];
      sample.loop = !sample.loop;
      if(sample.loop){
        this.trigger(key);
      }else{
        if (clip_launcher.hasOwnProperty('loop')){
          clearInterval(clip_launcher.loop);
          delete clip_launcher.loop;
        }
        this.decay(key);
      }
    },
    setEndNow:function(key){
      var clip_launcher = stems[key];
      if (!clip_launcher){
        return;
      }
      var sample = this.samples[clip_launcher.clip_id()];
      sample.end=clip_launcher.getCurrentTime();
      clip_launcher.end=sample.start;
      var clip_launcher = stems[key];
      if (clip_launcher){
        console.log('ending sample at ' + sample.end)
        if (sample.loop){
          samplr.trigger(key);
        }else{
          clip_launcher.pauseVideo();
        }
      }
    },

    addsample: function () {
      var value = this.newsample
      if (!value || !value.trigger || !value.id) {
        return
      }
      if (value.id.indexOf('?v=')!=-1){
        value.id=value.id.substring(value.id.indexOf('?v=')+3);
      }
      this.samples.push({
        id: value.id,
        trigger: value.trigger,
        start: 0,
        end: -1,
        loop: false
      })
      this.newsample = {}
      this.adding=false;
    },
    removesample: function (sample) {
      this.samples.splice(this.samples.indexOf(sample), 1)
    },
    editsample: function (sample) {
      this.editing=true;
      this.beforeEditCache = Vue.util.extend({}, sample)
      this.editedsample = sample
    },
    doneEdit: function (sample) {
      if (!sample,!sample.trigger) {
        return
      }
      if (sample.id.indexOf('?v=')!=-1){
        sample.id=sample.id.substring(sample.id.indexOf('?v=')+3);
      }
      var index = this.samples.indexOf(sample)
      if (index==-1){
        this.samples.push(sample);
      }else{
        Vue.set(this.samples,index, sample);
      }
      this.editedsample = {}
      this.editing=false;
    },
    cancelEdit: function (sample) {
      this.editedsample = {}
      sample = this.beforeEditCache
    },
    removediscounted: function () {
      this.samples = filters.active(this.samples)
    }
  },
  // a custom directive to wait for the DOM to be updated
  // before focusing on the input field.
  // http://vuejs.org/guide/custom-directive.html
  directives: {
    'sample-focus': function (el, value) {
      if (value) {
        el.focus()
      }
    }
  }
})
// handle routing
function onHashChange () {
  var hash = window.location.hash.replace(/#\/?/, '')
  window.hash_state = decodeURIComponent(hash)
  if (hash.length>10){
    window.setTimeout(samplr.loadHashState, 2000);
  }
}
window.addEventListener('hashchange', onHashChange)
onHashChange()
// mount
samplr.$mount('.samplr')
window.onkeydown = function(e){
  if (e.keyCode==16){
    return;
  }
  var key = e.key.toLowerCase()
  var idle_pad =  window.active_pads[key] == false;
  if (e.ctrlKey && e.shiftKey){
    samplr.toggleloop(key);
    return;
  }
  if (e.ctrlKey){
    samplr.setEndNow(key);
    samplr.decay(key);
    return;
  }
  if (e.shiftKey){
    samplr.setStartNow(key);
    return;
  }
  if (idle_pad){
    samplr.trigger(key);
  }

};
window.onkeyup = function(e){
  if (e.keyCode==16){
    return;
  }
  var key = e.key.toLowerCase()
  window.active_pads[key]=false
  if (e.shiftKey){
    samplr.setStartNow(key);
    return;
  }
  if (e.ctrlKey){
    samplr.setEndNow(key);
    samplr.decay(key);
    return;
  }
  samplr.release(key);

};
