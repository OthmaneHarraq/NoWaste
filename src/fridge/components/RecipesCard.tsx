import { ActivityIndicator, Image, Linking, Pressable, Text, View } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useHousehold } from '@/household'
import { displayName } from '@/fridge/categories'
import { EXPIRING_SOON_DAYS } from '@/fridge/config'
import { useFridge } from '@/fridge/FridgeProvider'
import { useRecipes, type Recipe } from '@/fridge/recipes'
import { FadeIn } from '@/ui/motion'
import { useTheme } from '@/ui/ThemeProvider'
import { shadow } from '@/ui/theme'

const list = (names: string[]) =>
  names.length <= 2 ? names.join(' and ') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`

/** Recipe ideas that use up what's expiring in the next couple of days. */
export function RecipesCard({ delay = 120 }: { delay?: number }) {
  const { current, now } = useFridge()
  const { household } = useHousehold()
  const { c } = useTheme()
  const state = useRecipes(current, household?.id, now)

  return (
    <FadeIn delay={delay}>
      <View className="rounded-3xl border border-line bg-surface p-5" style={shadow.card}>
        <View className="mb-3 flex-row items-center gap-2">
          <MaterialCommunityIcons name="chef-hat" size={18} color={c.textSoft} />
          <Text className="font-display flex-1 text-[17px] text-ink">Use it up</Text>
        </View>

        {state.status === 'empty' && (
          <Text className="text-[13px] leading-5 text-mute">
            Nothing expires in the next {EXPIRING_SOON_DAYS} days. Recipe ideas for using things up will show here when something does.
          </Text>
        )}

        {state.status !== 'empty' && (
          <Text className="mb-3 text-[13px] leading-5 text-ink-soft">
            Expiring soon: <Text className="font-semibold text-ink">{list(state.expiring.map(displayName))}</Text>
          </Text>
        )}

        {state.status === 'loading' && (
          <View className="flex-row items-center gap-2 py-3">
            <ActivityIndicator size="small" color={c.muted} />
            <Text className="text-[13px] text-mute">Finding recipes…</Text>
          </View>
        )}

        {state.status === 'none' && (
          <Text className="text-[13px] leading-5 text-mute">No recipe matches for these. Try a quick stir-fry, soup or omelette to use them together.</Text>
        )}

        {state.status === 'error' && (
          <View className="flex-row items-center justify-between gap-3 rounded-2xl bg-frost p-3">
            <Text className="flex-1 text-[13px] text-ink-soft">Couldn’t load recipe ideas right now.</Text>
            <Pressable onPress={state.retry} className="rounded-full bg-ink px-3 py-1.5 active:opacity-80" accessibilityRole="button">
              <Text className="text-xs font-semibold text-on-ink">Try again</Text>
            </Pressable>
          </View>
        )}

        {state.status === 'ready' && (
          <View className="gap-2.5">
            {state.recipes.map(r => <RecipeRow key={r.id} recipe={r} />)}
            <Text className="mt-1 text-[11px] text-mute">
              {state.source === 'ai' ? 'Ideas written by AI. Use your judgement on food safety.' : 'Recipes from TheMealDB'}
            </Text>
          </View>
        )}
      </View>
    </FadeIn>
  )
}

function RecipeRow({ recipe }: { recipe: Recipe }) {
  const { c } = useTheme()
  const body = (
    <View className="flex-row items-center gap-3 rounded-2xl bg-frost p-2.5">
      {recipe.image
        ? <Image source={{ uri: recipe.image }} style={{ width: 52, height: 52, borderRadius: 12 }} accessibilityIgnoresInvertColors />
        : (
          <View className="h-[52px] w-[52px] items-center justify-center rounded-xl bg-surface">
            <MaterialCommunityIcons name="silverware-fork-knife" size={20} color={c.muted} />
          </View>
        )}
      <View className="flex-1">
        <Text className="text-[14px] font-semibold text-ink" numberOfLines={2}>{recipe.title}</Text>
        {!!recipe.summary && <Text className="mt-0.5 text-xs leading-4 text-ink-soft" numberOfLines={3}>{recipe.summary}</Text>}
        {recipe.uses.length > 0 && (
          <Text className="mt-0.5 text-xs font-semibold text-fresh-700">Uses {list(recipe.uses)}</Text>
        )}
      </View>
      {recipe.url && <MaterialCommunityIcons name="open-in-new" size={16} color={c.muted} />}
    </View>
  )
  if (!recipe.url) return body
  return (
    <Pressable onPress={() => Linking.openURL(recipe.url!)} className="active:opacity-80" accessibilityRole="link" accessibilityLabel={`${recipe.title}, open recipe`}>
      {body}
    </Pressable>
  )
}
