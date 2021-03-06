require('es6-promise').polyfill()
require('isomorphic-fetch')

const REPO_OWNER = 'BirkhoffLee'
const REPO_NAME = 'read_tracking'
const REPO_ID = 122902870

module.exports = (app) => {
  app.post('/reading', (req, res) => {
    if (typeof req.body.payload === "undefined") {
      res.json({ message: 'payload required' })
    }
      
    const { GITHUB_ACCESS_TOKEN, ZENHUB_ACCESS_TOKEN, ZENHUB_ACCESS_TOKEN_V4 } = req.webtaskContext.secrets
    const { action, issue } = JSON.parse(req.body.payload)
    const { url, html_url, number } = issue

    console.info(`[BEGIN] issue updated with action: ${action}`)

    if (action === 'opened') {
      fetch(`${url}?access_token=${GITHUB_ACCESS_TOKEN}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ milestone: 1, }),
      }).then(
        () => console.info(`[END] set milestone successful! ${html_url}`),
        (e) => res.json(e)
      )
    } else if (action === 'milestoned') {
      fetch(`https://api.zenhub.io/p1/repositories/${REPO_ID}/issues/${number}/estimate?access_token=${ZENHUB_ACCESS_TOKEN}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estimate: 1 }),
      }).then(
        () => console.info(`[END] Set estimate successful! ${html_url}`),
        (e) => console.error(`[END] Failed to set estimate! ${html_url}`, e)
      )
      fetch(`https://api.zenhub.io/v4/reports/release/5a938621dd7dee163b3f8293/items/issues?access_token=${ZENHUB_ACCESS_TOKEN_V4}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `add_issues%5B0%5D%5Bissue_number%5D=${number}&add_issues%5B0%5D%5Brepo_id%5D=${REPO_ID}`,
      }).then(
        () => console.info(`[END] set release successful! ${html_url}`),
        (e) => console.error(`[END] Failed to set release! ${html_url}`, e)
      )
    }

    res.json({ message: 'issue updated!' })
  }
)

app.get('/reading', (req, res) => {
  const { GITHUB_ACCESS_TOKEN } = req.webtaskContext.secrets

  console.info('[BEGIN]', req.query)
  const title = req.query.title

  let keyword = encodeURIComponent(title.replace(/\s/g, '+'))
  console.info('[KEYWORD]', keyword)

  fetch(`https://api.github.com/search/issues?q=${keyword}%20repo:birkhofflee/read_tracking`)
    .then(response => response.json())
    .then(data => {
      console.info('[RESULT]', data)
      if (data.total_count > 0) {
        data.items.forEach(({ url, html_url }) =>
          fetch(`${url}?access_token=${GITHUB_ACCESS_TOKEN}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ state: 'closed' })
          })
            .then(() => console.info(`[END] issue closed successful! ${html_url}`))
            .catch(err => res.json('error', { error: err })))
        res.json({ message: 'Closed issue successful!' })
      } else {
        console.info('[RESULT]', data)

        fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/issues?access_token=${GITHUB_ACCESS_TOKEN}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title }),
        })
          .then(response => response.json())
          .then(({ url, html_url }) => {
            console.info(`[END] issue created successful! ${html_url}`)
            fetch(`${url}?access_token=${GITHUB_ACCESS_TOKEN}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ state: 'closed' })
            })
              .then(() => console.info(`[END] issue closed successful! ${html_url}`))
              .catch(err => res.json('error', { error: err }))
          })
          .catch(err => res.json('error', { error: err }))
      }
      res.json({ error: 'Finished achieve reading item!' })
    })
    .catch(err => res.json('error', { error: err }))
})

app.post('/reading-note', (req, res) => {
  const { GITHUB_ACCESS_TOKEN } = req.webtaskContext.secrets

  const title = req.query.title
  const note = req.body.note
  console.info('[BEGIN]', { title, note })

  let keyword = encodeURIComponent(title.replace(/\s/g, '+'))
  console.info('[KEYWORD]', keyword)

  fetch(`https://api.github.com/search/issues?q=${keyword}%20repo:birkhofflee/read_tracking%20is:open`)
    .then(response => response.json())
    .then(data => {
      console.info('[RESULT]', data)
      if (data.total_count > 0) {
        data.items.forEach(({ url, html_url }) =>
          fetch(`${url}/comments?access_token=${GITHUB_ACCESS_TOKEN}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ body: `> ${note}` })
          })
            .then(() => console.info(`[END] added comment successful! ${html_url}`))
            .catch(err => res.json('error', { error: err })))
        res.json({ message: 'Added comment into issue successful!' })
      }
      res.json({ error: 'Not Found!' })
    })
    .catch(err => res.json('error', { error: err }))
  })
}
