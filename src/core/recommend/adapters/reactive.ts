// Framework-independent reactivity keeps the desktop state machine unchanged. No Vue UI runtime.
export { ref, reactive, computed, watch, effectScope } from '@vue/reactivity'
export const nextTick = async() => Promise.resolve()
