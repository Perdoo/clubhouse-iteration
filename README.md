# Shortcut Iteration Action

Create an iteration on Shortcut and assign stories that were recently marked as completed.

## Inputs

### `shortcutToken`

_Required._ Shortcut API auth token.

### `name`

_Required._ Iteration name.

### `description`

_Required._ Iteration description.

### `completedStateId`

_Required._ Workflow state id for the completed state.

### `completedAfter`

_Required._ Datetime when the stories were moved to the completed state

### `canCreateIfNoNewStories`

_Optional._ Create the iteration even if there aren't any stories to assign to it.

## Outputs

### `iteration-created`

Was the iteration created.

### `url`

Iteration URL.

## Example usage

Firstly, add an event handler on Shortcut to move a story into the completed state when its branch gets merged into your main branch. Then use the below snippet to set up the action.

```yaml
uses: perdoo/shortcut-iteration-action@v2.0.0
with:
  shortcutToken: ${{ secrets.SHORTCUT_TOKEN }}
  name: "v1.2.3"
  completedStateId: 123456789
  completedAfter: ${{ github.event.head_commit.timestamp }}
```

To get your completed workflow state id, use:

```shell
curl -X GET \
  -H "Content-Type: application/json" \
  -H "Shortcut-Token: $SHORTCUT_TOKEN" \
  -L "https://api.app.shortcut.com/api/v3/workflows"
```
