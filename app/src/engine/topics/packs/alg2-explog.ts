/** Algebra 2: exponential and logarithmic functions. */
import type { TopicGenerator } from '../../types';
import { expEqCommonBase, expEqLogs } from '../algebra2/explog/exp-equations';
import { expGraph, logGraph } from '../algebra2/explog/graphs';
import { inversesExpLog } from '../algebra2/explog/inverses';
import { evaluateLogs, expLogForms, logExpInverses } from '../algebra2/explog/logs';
import { logProperties, logsInTermsOfOthers } from '../algebra2/explog/properties';

const topics: TopicGenerator[] = [
  expGraph,
  expEqCommonBase,
  expLogForms,
  evaluateLogs,
  logExpInverses,
  logProperties,
  logsInTermsOfOthers,
  expEqLogs,
  inversesExpLog,
  logGraph,
];

export default topics;
