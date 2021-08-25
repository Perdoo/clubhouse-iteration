# Clubhouse Iteration Action

Create an iteration on Clubhouse.

## Inputs

### `chToken`

_Required._ Clubhouse API auth token.

### `name`

_Required._ Iteration name.

### `assignStoriesFromStateId`

_Required._ Workflow state id that contains the stories for the iteration.

### `createIfStateEmpty`

_Optional._ Create the iteration even if there aren't any stories to assign to it.

## Outputs

### `iteration-created`

Was the iteration created.

### `url`

Iteration URL.

## Example usage

```yaml
uses: Perdoo/clubhouse-iteration-action@v1
with:
  chToken: ${{ secrets.CLUBHOUSE_TOKEN }}
  name: "v1.2.3"
  assignStoriesFromStateId: 123456789
```

To get your workflow state ids, use:

```shell
curl -X GET \
  -H "Content-Type: application/json" \
  -H "Clubhouse-Token: $CLUBHOUSE_TOKEN" \
  -L "https://api.clubhouse.io/api/v3/workflows"
```
