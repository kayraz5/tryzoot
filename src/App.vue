<!-- EDITOR: HULBERT -->
<script setup>
import { computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import AppNav from './view/app/AppNav.vue'
import ToastHost from './view/app/ToastHost.vue'
import StampCelebration from './view/components/passport/StampCelebration.vue'
import RainOverlay from './view/common/weather/RainOverlay.vue'
import SkyEffects from './view/common/weather/SkyEffects.vue'
import CenterDialog from './view/app/CenterDialog.vue'
import QuestChatHost from './view/components/quests/QuestChatHost.vue'
import QuestLiveHost from './view/components/quests/QuestLiveHost.vue'
import { useUserStore } from './model/stores/user.js'
import { useMissionStore } from './model/stores/mission.js'
import { usePartyStore } from './model/stores/party.js'
import { usePassportStore } from './model/stores/passport.js'
import { useUiStore } from './model/stores/ui.js'

const route = useRoute()
const user = useUserStore()
const passport = usePassportStore()
const ui = useUiStore()
const showNav = computed(() => route.meta.nav && user.isAuthed && !ui.navHidden)

const mission = useMissionStore()
const party = usePartyStore()

watch(() => user.userId, (id, old) => {
  // Signed out, or someone else signed in on this device: drop the last account's mission and
  // quest, or the next save would write to a mission this account doesn't own (RLS refuses it).
  if (old && id !== old) {
    mission.forgetAccount()
    party.$reset()
  }
  passport.load(id)
}, { immediate: true })
</script>

<template>
  <RouterView v-slot="{ Component }">
    <component :is="Component" />
  </RouterView>
  <AppNav v-if="showNav" />
  <SkyEffects />
  <RainOverlay />
  <ToastHost />
  <StampCelebration />
  <CenterDialog />
  <QuestChatHost v-if="user.isAuthed" />
  <QuestLiveHost v-if="user.isAuthed" />
</template>
