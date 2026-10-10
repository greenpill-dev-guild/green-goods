import Link from "@docusaurus/Link";
import projections from "@site/src/data/integration-projections.json";

type IntegrationNetwork = {
  chainId: number;
  name: string;
  status: string;
  recorded: string[];
};

type IntegrationRecord = {
  display: string;
  definition: string;
  networks: IntegrationNetwork[];
  totalNetworks: number;
  indexedContracts: string[];
};

/**
 * One row per catalogued integration: where the checked-in artifacts record its components and
 * which of its contracts the indexer follows. The Markdown twins render the same table
 * (docs/scripts/llms.mjs), so keep the columns aligned when changing either.
 */
export function IntegrationStatusTable() {
  const entries = Object.entries(projections.integrations as Record<string, IntegrationRecord>).sort(
    ([a], [b]) => a.localeCompare(b),
  );
  return (
    <table>
      <thead>
        <tr>
          <th>Integration</th>
          <th>Networks with recorded components</th>
          <th>Indexed contracts</th>
        </tr>
      </thead>
      <tbody>
        {entries.map(([id, record]) => (
          <tr key={id}>
            <td>
              <Link to={`/builders/integrations/${id}`}>{record.display}</Link>
            </td>
            <td>
              {record.networks.length === 0
                ? "None recorded"
                : record.networks.map((network, index) => (
                    <span key={network.chainId}>
                      {index > 0 ? ", " : null}
                      {network.name} ({network.status})
                    </span>
                  ))}
            </td>
            <td>
              {record.indexedContracts.length === 0
                ? "none"
                : record.indexedContracts.map((name, index) => (
                    <span key={name}>
                      {index > 0 ? ", " : null}
                      <code>{name}</code>
                    </span>
                  ))}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
