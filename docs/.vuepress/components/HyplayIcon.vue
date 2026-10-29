<script setup lang="ts">
import { computed } from 'vue'
import { iconPaths } from '../utils/icons'

const props = defineProps<{ name: string }>()

// 组件内使用的图标走内联 SVG（离线可用），未收录的回退到主题自带的 Iconify 组件
const path = computed(() => iconPaths[props.name] ?? '')
</script>

<template>
  <svg
    v-if="path"
    class="hyplay-icon"
    viewBox="0 0 24 24"
    width="1em"
    height="1em"
    aria-hidden="true"
    v-html="path"
  />
  <VPIcon v-else :name="name" class="hyplay-icon" />
</template>

<style scoped>
.hyplay-icon {
  display: inline-block;
  flex: none;
  width: 1em;
  height: 1em;
  fill: currentColor;
  vertical-align: -0.125em;
}
</style>
