(function (global) {
  'use strict';

  var CANON = {
    silence:          { triggerClass: 'whisper', sizeKey: 'whisperSize',    phase: 'idle',       hold: 460,  priority: 1 },
    core:             { triggerClass: 'whisper', sizeKey: 'whisperSize',    phase: 'idle',       hold: 520,  priority: 1 },
    ma:               { triggerClass: 'whisper', sizeKey: 'whisperSize',    phase: 'idle',       hold: 620,  priority: 1 },
    shadow:           { triggerClass: 'whisper', sizeKey: 'whisperSize',    phase: 'shadow',     hold: 980,  priority: 2 },
    echo:             { triggerClass: 'whisper', sizeKey: 'whisperSize',    phase: 'shadow',     hold: 820,  priority: 2 },
    observation:      { triggerClass: 'hover',   sizeKey: 'hoverSize',      phase: 'observe',    hold: 1040, priority: 2 },
    self_question:    { triggerClass: 'hover',   sizeKey: 'hoverSize',      phase: 'observe',    hold: 1120, priority: 2 },
    past_speculation: { triggerClass: 'hover',   sizeKey: 'hoverSize',      phase: 'shadow',     hold: 1120, priority: 2 },
    quotation:        { triggerClass: 'hover',   sizeKey: 'hoverSize',      phase: 'shadow',     hold: 1040, priority: 2 },
    resonance:        { triggerClass: 'click',   sizeKey: 'clickSize',      phase: 'resonance',  hold: 1440, priority: 3 },
    emit:             { triggerClass: 'click',   sizeKey: 'clickSize',      phase: 'emit',       hold: 1160, priority: 3 },
    declaration:      { triggerClass: 'click',   sizeKey: 'clickSize',      phase: 'emit',       hold: 1240, priority: 3 },
    consensus:        { triggerClass: 'click',   sizeKey: 'clickSize',      phase: 'resonance',  hold: 1380, priority: 3 },
    future_command:   { triggerClass: 'click',   sizeKey: 'clickSize',      phase: 'revelation', hold: 1400, priority: 4 },
    leap:             { triggerClass: 'special', sizeKey: 'revelationSize', phase: 'revelation', hold: 1460, priority: 4 },
    revelation:       { triggerClass: 'special', sizeKey: 'revelationSize', phase: 'revelation', hold: 1640, priority: 4 },
    summon:           { triggerClass: 'special', sizeKey: 'summonSize',     phase: 'summon',     hold: 1800, priority: 4 }
  };

  var REGISTER = {
    whisper: { priority: 1, fallbackSizeKey: 'whisperSize' },
    hover:   { priority: 2, fallbackSizeKey: 'hoverSize' },
    click:   { priority: 3, fallbackSizeKey: 'clickSize' },
    special: { priority: 4, fallbackSizeKey: 'hoverSize' }
  };

  function getCanon(name) {
    return name ? CANON[name] || null : null;
  }

  function getRegister(name) {
    return name ? REGISTER[name] || null : null;
  }

  function listByTrigger(triggerClass) {
    return Object.keys(CANON).filter(function (canonName) {
      return CANON[canonName].triggerClass === triggerClass;
    });
  }

  function getRegisterClass(canonName, fallbackRegister) {
    var canon = getCanon(canonName);
    return (canon && canon.triggerClass) || fallbackRegister || 'hover';
  }

  function getSizeKey(canonName, fallbackRegister) {
    var canon = getCanon(canonName);
    if (canon && canon.sizeKey) return canon.sizeKey;
    var register = getRegister(getRegisterClass(canonName, fallbackRegister));
    return (register && register.fallbackSizeKey) || 'hoverSize';
  }

  function getPhaseRule(canonName, fallbackRegister) {
    var canon = getCanon(canonName);
    if (canon) {
      return {
        phase: canon.phase,
        hold: canon.hold,
        priority: canon.priority
      };
    }
    var registerClass = getRegisterClass(canonName, fallbackRegister);
    if (registerClass === 'click') return { phase: 'emit', hold: 1020, priority: 3 };
    if (registerClass === 'hover') return { phase: 'observe', hold: 860, priority: 1 };
    return { phase: 'idle', hold: 480, priority: 1 };
  }

  global.InryokuCanonMeta = {
    CANON: CANON,
    REGISTER: REGISTER,
    KINDS: Object.keys(CANON),
    getCanon: getCanon,
    getRegister: getRegister,
    listByTrigger: listByTrigger,
    getRegisterClass: getRegisterClass,
    getSizeKey: getSizeKey,
    getPhaseRule: getPhaseRule
  };
})(typeof window !== 'undefined' ? window : this);
